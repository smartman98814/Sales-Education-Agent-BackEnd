import { ObjectId } from 'mongodb';

export interface Agent {
  _id?: ObjectId;
  agentNumber: number;
  userId: ObjectId;
  characterUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
