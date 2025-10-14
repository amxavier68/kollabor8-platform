import 'reflect-metadata';

/**
 * Method decorator for logging
 */
export function Log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    console.log(`[${new Date().toISOString()}] Calling ${propertyKey} with args:`, args);
    try {
      const result = await originalMethod.apply(this, args);
      console.log(`[${new Date().toISOString()}] ${propertyKey} returned:`, result);
      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ${propertyKey} failed:`, error);
      throw error;
    }
  };

  return descriptor;
}

/**
 * Method decorator for caching results
 */
export function Cache(ttl: number = 5000) {
  const cache = new Map<string, { value: any; timestamp: number }>();

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${propertyKey}_${JSON.stringify(args)}`;
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < ttl) {
        console.log(`[Cache HIT] ${propertyKey}`);
        return cached.value;
      }

      console.log(`[Cache MISS] ${propertyKey}`);
      const result = await originalMethod.apply(this, args);
      cache.set(cacheKey, { value: result, timestamp: Date.now() });
      return result;
    };

    return descriptor;
  };
}

/**
 * Method decorator for retry logic
 */
export function Retry(attempts: number = 3, delay: number = 1000) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: any;

      for (let i = 0; i < attempts; i++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          console.warn(`[Retry ${i + 1}/${attempts}] ${propertyKey} failed:`, error);
          
          if (i < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}

/**
 * Method decorator for measuring execution time
 */
export function Measure(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      console.log(`[Performance] ${propertyKey} took ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.log(`[Performance] ${propertyKey} failed after ${duration.toFixed(2)}ms`);
      throw error;
    }
  };

  return descriptor;
}

/**
 * Class decorator for dependency injection
 */
export function Injectable() {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      _injected = true;
      _constructedAt = new Date();
    };
  };
}

/**
 * Property decorator for required fields
 */
export function Required(target: any, propertyKey: string) {
  Reflect.defineMetadata('required', true, target, propertyKey);
}

/**
 * Property decorator for validation
 */
export function Validate(validationFn: (value: any) => boolean, errorMessage: string) {
  return function (target: any, propertyKey: string) {
    let value: any;

    const getter = function () {
      return value;
    };

    const setter = function (newVal: any) {
      if (!validationFn(newVal)) {
        throw new Error(`${propertyKey}: ${errorMessage}`);
      }
      value = newVal;
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Method decorator for debouncing
 */
export function Debounce(delay: number = 300) {
  let timeoutId: NodeJS.Timeout;

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        originalMethod.apply(this, args);
      }, delay);
    };

    return descriptor;
  };
}

/**
 * Method decorator for throttling
 */
export function Throttle(delay: number = 300) {
  let lastCall = 0;

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}
