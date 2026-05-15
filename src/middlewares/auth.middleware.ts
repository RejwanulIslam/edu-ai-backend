import { Request, Response, NextFunction } from "express";
import { auth } from "../config/auth";
import { sendUnauthorized, sendForbidden } from "../utils/response";
import prisma from "../config/database";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    image?: string | null;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });

    if (!session || !session.user) {
      sendUnauthorized(res, "Please login to continue");
      return;
    }

    // Get full user with role from DB
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, role: true, image: true, isActive: true },
    });

    if (!dbUser || !dbUser.isActive) {
      sendUnauthorized(res, "Account not found or disabled");
      return;
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      image: dbUser.image,
    };

    next();
  } catch (error) {
    sendUnauthorized(res, "Invalid or expired session");
  }
};

export const requireRole = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendForbidden(res, "You don't have permission to access this resource");
      return;
    }
    next();
  };

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (session?.user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, name: true, role: true, image: true, isActive: true },
      });
      if (dbUser?.isActive) {
        req.user = { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, image: dbUser.image };
      }
    }
  } catch {}
  next();
};
