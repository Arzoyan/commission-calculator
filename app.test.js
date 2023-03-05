const app = require("./calculateCommissions");

describe("myApp", () => {
  test("calculate Commissions fee ", async () => {
    let result = await app.calculateCommissions("input.json");
    expect(result).toStrictEqual([
      "0.06",
      "0.90",
      "87.00",
      "90.00",
      "90.30",
      "0.00",
      "5.00",
      "0.00",
      "0.00"
    ]);
  });
});
