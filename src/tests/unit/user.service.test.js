import { getAllUsers } from "../../services/user.service.js";

describe("User Service", () => {
  test("should return an array", async () => {
    const users = await getAllUsers();
    expect(Array.isArray(users)).toBe(true);
  });
});
