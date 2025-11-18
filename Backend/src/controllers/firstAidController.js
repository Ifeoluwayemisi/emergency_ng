import { firstAidService } from "../services/firstAidService.js";

export const getFirstAidList = async (req, res) => {
  try {
    const list = await firstAidService.getAllFirstAid();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
