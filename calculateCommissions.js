const fs = require("fs");
const API = require("./api");
const CONSTANTS = require("./constants");

function readFileAsync(fileName) {
  return new Promise((resolve, reject) => {
    fs.readFile(fileName, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

async function getData(fileName) {
  try {
    const inputData = await readFileAsync(fileName);
    const parsedData = JSON.parse(inputData);
    return parsedData;
  } catch (err) {
    console.error(err);
  }
}
const calculateCommissions = async (fileName) => {
  const data = await getData(fileName);
  // Initialize variables for calculating commission fees for each user
  const users = collectUserData(data);
  // get data for commission fee for cash in
  const cashIn = await API.getData(CONSTANTS.CASH_IN);
  // get data for commission fee for cash out for natural  type
  const cashOutNatural = await API.getData(CONSTANTS.CASH_OUT_NATURAL);
  // get data for commission fee for cash out for legal type
  const cashOutLegal = await API.getData(CONSTANTS.CASH_OUT_LEGAL);
  // percents commission fee for cash in
  const cashInFeeRate = cashIn.percents / CONSTANTS.PERCENT_NUMBER;
  // amount commission fee for cash in
  const cashInFeeMax = cashIn.max.amount;
  // amount commission fee for cash out
  const casOutNaturalWeeklyLimit = cashOutNatural.week_limit.amount;

  // amount commission fee for cash out for
  const cashOutNaturalFeeRate =
    cashOutNatural.percents / CONSTANTS.PERCENT_NUMBER;
  const cashOutLegalFeeRate = cashOutLegal.percents / CONSTANTS.PERCENT_NUMBER;
  const cashOutLegalFeeMin = cashOutLegal.min.amount;
  const result = data.map((item) => {
    return calculateUserCommission(item, users, {
      cashInFeeRate,
      cashInFeeMax,
      casOutNaturalWeeklyLimit,
      cashOutNaturalFeeRate,
      cashOutLegalFeeRate,
      cashOutLegalFeeMin,
    });
  });
  return result;
};

const collectUserData = (userData) => {
  const users = {};
  for (let item of userData) {
    if (!(item["user_id"] in users)) {
      users[item["user_id"]] = {
        type: item["user_type"],
        operations: [],
      };
    }
  }
  return users;
};

const calculateUserCommission = (
  item,
  users,
  {
    cashInFeeRate,
    cashInFeeMax,
    casOutNaturalWeeklyLimit,
    cashOutNaturalFeeRate,
    cashOutLegalFeeRate,
    cashOutLegalFeeMin,
  }
) => {
  const user_id = item.user_id;
  const user_type = users[user_id].type;
  const op_type = item.type;
  const amount = item.operation.amount;
  const date = parseDate(item.date);
  const week_start = new Date(date);
  week_start.setDate(date.getDate() - date.getDay());

  const week_end = new Date(week_start);
  week_end.setDate(week_start.getDate() + 6);

  const week_cash_out = users[user_id].operations
    .filter(
      (item) =>
        item.type === "cash_out" &&
        parseDate(item.date) >= week_start &&
        parseDate(item.date) <= week_end
    )
    .reduce((total, item) => total + item.operation.amount, 0);

  let fee;
  if (op_type === "cash_in") {
    // Calculate commission fee for cash in operation
    fee = ceil(amount * cashInFeeRate, 100);
    if (fee > cashInFeeMax) {
      fee = cashInFeeMax;
    }
  } else {
    if (user_type === "natural") {
      // Calculate commission fee for natural person cash out operation
      if (amount <= casOutNaturalWeeklyLimit - week_cash_out) {
        // No commission fee for cash out amount within weekly limit
        fee = 0;
      } else {
        // Commission fee for cash out amount exceeding weekly limit
        fee = ceil(
          (amount - (casOutNaturalWeeklyLimit - week_cash_out)) *
            cashOutNaturalFeeRate,
          100
        );
      }
    } else {
      // Calculate commission fee for legal person cash out operation
      fee = ceil(amount * cashOutLegalFeeRate, 100);
      if (fee < cashOutLegalFeeMin) {
        fee = cashOutLegalFeeMin;
      }
    }
  }

  // Add operation to user's list of operations
  users[user_id].operations.push(item);
  // Print calculated commission fee for the operation
  console.log(fee.toFixed(2));
  return fee.toFixed(2);
};

function parseDate(dateStr) {
  let parts = dateStr.split("-");
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function ceil(amount, roundNumber) {
  return Math.ceil(amount * roundNumber) / roundNumber;
}

module.exports = {
  calculateCommissions: calculateCommissions,
};
