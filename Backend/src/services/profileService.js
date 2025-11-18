import { prisma } from "../utils/prisma.js";

export const profileService = {
  updateProfile: async (userId, data, file) => {
    return prisma.user.update({
      where: { id: userId },
      data: { ...data, ...(file ? { profileImage: file.filename } : {}) },
    });
  },

  fakeVerifyResponder: async (id) => {
    return prisma.user.update({ where: { id }, data: { verified: true } });
  },
};
