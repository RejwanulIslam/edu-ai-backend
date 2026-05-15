import { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200,
  pagination?: ApiResponse["pagination"]
): Response => {
  const response: ApiResponse<T> = { success: true, message, data };
  if (pagination) response.pagination = pagination;
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message = "Internal Server Error",
  statusCode = 500,
  error?: string
): Response => {
  const response: ApiResponse = { success: false, message };
  if (error && process.env.NODE_ENV !== "production") response.error = error;
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(res: Response, data: T, message = "Created successfully"): Response =>
  sendSuccess(res, data, message, 201);

export const sendNotFound = (res: Response, message = "Not found"): Response =>
  sendError(res, message, 404);

export const sendBadRequest = (res: Response, message = "Bad request"): Response =>
  sendError(res, message, 400);

export const sendUnauthorized = (res: Response, message = "Unauthorized"): Response =>
  sendError(res, message, 401);

export const sendForbidden = (res: Response, message = "Forbidden"): Response =>
  sendError(res, message, 403);
