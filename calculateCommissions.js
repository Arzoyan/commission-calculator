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

  const result = calculateUserCommission(data, {
    cashInFeeRate,
    cashInFeeMax,
    casOutNaturalWeeklyLimit,
    cashOutNaturalFeeRate,
    cashOutLegalFeeRate,
    cashOutLegalFeeMin,
  });

  return result;
};

// Cash In commission calculation
function calculateCashInCommission({ amount, cashInFeeRate, cashInFeeMax }) {
  const commission = amount * cashInFeeRate;
  return roundUpToCents(
    Math.min(commission, cashInFeeMax),
    CONSTANTS.PERCENT_NUMBER
  );
}

// Cash Out commission calculation for legal persons
function calculateLegalPersonsCashOutCommission({
  amount,
  cashOutLegalFeeRate,
  cashOutLegalFeeMin,
}) {
  const commission = amount * cashOutLegalFeeRate;
  return roundUpToCents(
    Math.max(commission, cashOutLegalFeeMin),
    CONSTANTS.PERCENT_NUMBER
  );
}

// Cash Out commission calculation for natural persons
function calculateNaturalPersonsCashOutCommission({
  amount,
  totalCashOutThisWeek,
  isLimitOver,
  casOutNaturalWeeklyLimit,
  cashOutNaturalFeeRate,
}) {
  let commission = 0;
  if (
    totalCashOutThisWeek + amount <= casOutNaturalWeeklyLimit &&
    !isLimitOver
  ) {
    // Free of charge
    return "0.00";
  } else {
    if (isLimitOver) {
      commission = amount * cashOutNaturalFeeRate;
    } else {
      // casOutNaturalWeeklyLimit EUR per week (from monday to sunday) is free of charge.
      const exceededAmount =
        amount - (casOutNaturalWeeklyLimit - totalCashOutThisWeek);

      if (exceededAmount > 0) {
        commission = exceededAmount * cashOutNaturalFeeRate;
      } else {
        exceededAmount;
      }
    }
  }
  return roundUpToCents(commission, CONSTANTS.PERCENT_NUMBER);
}

const calculateUserCommission = (
  data,
  {
    cashInFeeRate,
    cashInFeeMax,
    casOutNaturalWeeklyLimit,
    cashOutNaturalFeeRate,
    cashOutLegalFeeRate,
    cashOutLegalFeeMin,
  }
) => {
  const totalCashOutThisWeek = {};
  const result = [];
  for (let item of data) {
    let fee = 0;
    if (item.type === "cash_in") {
      // Calculate commission fee for cash in each item
      fee = calculateCashInCommission({
        amount: item.operation.amount,
        cashInFeeRate,
        cashInFeeMax,
      });
    } else {
      if (item.user_type === "natural") {
        // Calculate commission fee for natural person cash out
        let currentTotalCashOutThisWeek = 0;
        let isLimitOver = false;
        if (
          totalCashOutThisWeek[item.user_id] &&
          totalCashOutThisWeek[item.user_id][getMonth(item.date)]
        ) {
          currentTotalCashOutThisWeek =
            totalCashOutThisWeek[item.user_id][getMonth(item.date)].amount;

          isLimitOver =
            totalCashOutThisWeek[item.user_id][getMonth(item.date)].isLimitOver;
        }

        fee = calculateNaturalPersonsCashOutCommission({
          amount: item.operation.amount,
          totalCashOutThisWeek: currentTotalCashOutThisWeek,
          isLimitOver,
          casOutNaturalWeeklyLimit,
          cashOutNaturalFeeRate,
        });
        // save each item cash out amount and check is mouthily limit is over or not
        if (totalCashOutThisWeek[item.user_id]) {
          if (totalCashOutThisWeek[item.user_id][getMonth(item.date)]) {
            (totalCashOutThisWeek[item.user_id][
              getMonth(item.date)
            ].isLimitOver =
              totalCashOutThisWeek[item.user_id][getMonth(item.date)].amount +
                item.operation.amount -
                casOutNaturalWeeklyLimit >=
              0),
              (totalCashOutThisWeek[item.user_id][getMonth(item.date)].amount =
                totalCashOutThisWeek[item.user_id][getMonth(item.date)].amount +
                item.operation.amount);
          } else {
            totalCashOutThisWeek[item.user_id][getMonth(item.date)] = {
              amount: item.operation.amount,
              isLimitOver: item.operation.amount - casOutNaturalWeeklyLimit > 0,
            };
          }
        } else {
          totalCashOutThisWeek[item.user_id] = {
            [getMonth(item.date)]: {
              amount: item.operation.amount,
              isLimitOver: item.operation.amount - casOutNaturalWeeklyLimit > 0,
            },
          };
        }
      } else {
        fee = calculateLegalPersonsCashOutCommission({
          amount: item.operation.amount,
          cashOutLegalFeeRate,
          cashOutLegalFeeMin,
        });
      }
    }
    // Print calculated commission fee for the operation
    console.log(fee);
    result.push(fee);
  }
  return result;
};

// Helper function to round to the nearest cent
function roundUpToCents(amount, roundNumber) {
  return (Math.ceil(amount * roundNumber) / roundNumber).toFixed(2);
}
//function below to get the week number of a given date within its corresponding year
function getMonth(date) {
  let currentDate = new Date(date);

  currentDate = new Date(
    currentDate.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    })
  );

  return new Date(currentDate).getMonth() + 1;
}

module.exports = {
  calculateCommissions: calculateCommissions,
};
