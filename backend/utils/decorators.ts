import 'reflect-metadata';

// Method decorator for logging
export function Log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    console.log(`[${new Date().toISOString()}] Calling ${propertyKey} with args:`, args);
    const result = await originalMethod.apply(this, args);
    console.log(`[${new Date().toISOString()}] ${propertyKey} returned:`, result);
    return result;
  };

  return descriptor;
}

// Property decorator
export function Required(target: any, propertyKey: string) {
  Reflect.defineMetadata('required', true, target, propertyKey);
}

// Class decorator
export function Injectable() {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      injected = true;
    };
  };
}

// Parameter decorator
export function Inject(token: string) {
  return function (target: Object, propertyKey: string | symbol, parameterIndex: number) {
    const existingParameters: number[] = Reflect.getOwnMetadata('inject', target, propertyKey) || [];
    existingParameters.push(parameterIndex);
    Reflect.defineMetadata('inject', existingParameters, target, propertyKey);
  };
}