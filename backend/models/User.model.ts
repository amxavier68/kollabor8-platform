import { prop, getModelForClass } from '@typegoose/typegoose';

export class User {
  @prop({ required: true })
  public name!: string;

  @prop({ required: true, unique: true })
  public email!: string;

  @prop({ required: true })
  public password!: string;

  @prop({ default: 'user' })
  public role!: string;

  @prop({ default: Date.now })
  public createdAt!: Date;
}

export const UserModel = getModelForClass(User);