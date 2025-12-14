import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  email: string;
  password?: string; // Hashed password
  displayName?: string;
  avatar?: string;
  username?: string;
  authMethod?: "email" | "google" | "discord" | "telegram" | "x";
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface AuthTokens {
  _id?: ObjectId;
  userId: ObjectId;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
}
