import { prisma } from "../utils/prisma.js";

export const firstAidService = {
  getAllFirstAid: async () => prisma.firstAid.findMany(),
};
