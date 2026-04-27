const STORAGE_KEY = "pricingPlans";
const MAX_SAVED_PLANS = 6;

function listPlans() {
  return wx.getStorageSync(STORAGE_KEY) || [];
}

function savePlan(plan) {
  const savedPlans = [plan].concat(listPlans()).slice(0, MAX_SAVED_PLANS);
  wx.setStorageSync(STORAGE_KEY, savedPlans);
  return savedPlans;
}

function clearPlans() {
  wx.removeStorageSync(STORAGE_KEY);
  return [];
}

module.exports = {
  listPlans,
  savePlan,
  clearPlans,
};
