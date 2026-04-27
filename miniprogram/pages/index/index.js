const channelOptions = ["到店自取", "即时配送", "预约服务", "线上虚拟商品"];
const timeOptions = ["工作日白天", "工作日晚高峰", "周末", "节假日"];
const tierOptions = ["普通用户", "银卡会员", "金卡会员", "新客"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function calculatePrice(form) {
  const cost = Number(form.cost) || 0;
  const basePrice = Number(form.basePrice) || 0;
  const inventory = Number(form.inventory) || 0;
  const demand = Number(form.demand) || 0;
  const competitor = Number(form.competitorPrice) || 0;
  const targetMargin = Number(form.targetMargin) || 0;

  const minPrice = cost / (1 - clamp(targetMargin, 5, 80) / 100);
  const demandFactor = 1 + (demand - 50) * 0.006;
  const inventoryFactor = inventory < 25 ? 1 + (25 - inventory) * 0.008 : 1 - (inventory - 25) * 0.0025;
  const timeFactorMap = [1, 1.08, 1.06, 1.15];
  const channelFactorMap = [0.98, 1.04, 1.02, 0.94];
  const tierDiscountMap = [0, 0.03, 0.06, 0.08];

  const marketAnchor = competitor > 0 ? basePrice * 0.65 + competitor * 0.35 : basePrice;
  const rawPrice =
    marketAnchor *
    demandFactor *
    inventoryFactor *
    timeFactorMap[form.timeIndex] *
    channelFactorMap[form.channelIndex];
  const discounted = rawPrice * (1 - tierDiscountMap[form.tierIndex]);
  const ceiling = competitor > 0 ? competitor * 1.18 : basePrice * 1.45;
  const suggestedPrice = clamp(discounted, minPrice, Math.max(minPrice, ceiling));
  const profit = suggestedPrice - cost;
  const margin = suggestedPrice > 0 ? (profit / suggestedPrice) * 100 : 0;
  const expectedRevenue = suggestedPrice * demand;

  const reasons = [];
  reasons.push(demand >= 70 ? "需求偏高，允许价格上浮" : demand <= 35 ? "需求偏弱，价格保持克制" : "需求稳定，按基准价微调");
  reasons.push(inventory <= 25 ? "库存紧张，提高稀缺性溢价" : inventory >= 75 ? "库存充足，适度让利促进转化" : "库存健康，无需大幅修正");
  reasons.push(timeOptions[form.timeIndex] + "场景已纳入时段系数");
  reasons.push(tierOptions[form.tierIndex] + "折扣已计入最终价");

  return {
    suggestedPrice: money(suggestedPrice),
    minPrice: money(minPrice),
    maxPrice: money(Math.max(minPrice, ceiling)),
    profit: money(profit),
    margin: money(margin),
    expectedRevenue: money(expectedRevenue),
    reasons,
  };
}

Page({
  data: {
    channelOptions,
    timeOptions,
    tierOptions,
    form: {
      productName: "拿铁咖啡",
      cost: 9,
      basePrice: 22,
      competitorPrice: 21,
      targetMargin: 35,
      inventory: 42,
      demand: 68,
      channelIndex: 1,
      timeIndex: 1,
      tierIndex: 0,
    },
    result: {},
    strategyJson: "",
    channelLabel: channelOptions[1],
    timeLabel: timeOptions[1],
    tierLabel: tierOptions[0],
    savedPlans: [],
  },

  onLoad() {
    this.loadSavedPlans();
    this.refreshPrice();
  },

  loadSavedPlans() {
    const savedPlans = wx.getStorageSync("pricingPlans") || [];
    this.setData({ savedPlans });
  },

  onNumberInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const patch = {};
    patch[`form.${field}`] = value;
    this.setData(patch, () => this.refreshPrice());
  },

  onTextInput(e) {
    this.setData({
      "form.productName": e.detail.value,
    }, () => this.refreshPrice());
  },

  onSliderChange(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch[`form.${field}`] = e.detail.value;
    this.setData(patch, () => this.refreshPrice());
  },

  onPickerChange(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch[`form.${field}`] = Number(e.detail.value);
    this.setData(patch, () => this.refreshPrice());
  },

  applyScenario(e) {
    const type = e.currentTarget.dataset.type;
    const scenarios = {
      peak: {
        demand: 86,
        inventory: 18,
        timeIndex: 1,
        channelIndex: 1,
      },
      clearance: {
        demand: 32,
        inventory: 88,
        timeIndex: 0,
        channelIndex: 0,
      },
      holiday: {
        demand: 78,
        inventory: 36,
        timeIndex: 3,
        channelIndex: 2,
      },
    };
    this.setData({
      form: Object.assign({}, this.data.form, scenarios[type]),
    }, () => this.refreshPrice());
  },

  refreshPrice() {
    const result = calculatePrice(this.data.form);
    const payload = {
      productName: this.data.form.productName,
      channel: channelOptions[this.data.form.channelIndex],
      timeScene: timeOptions[this.data.form.timeIndex],
      userTier: tierOptions[this.data.form.tierIndex],
      inputs: {
        cost: Number(this.data.form.cost) || 0,
        basePrice: Number(this.data.form.basePrice) || 0,
        competitorPrice: Number(this.data.form.competitorPrice) || 0,
        inventory: Number(this.data.form.inventory) || 0,
        demand: Number(this.data.form.demand) || 0,
        targetMargin: Number(this.data.form.targetMargin) || 0,
      },
      output: result,
      updatedAt: new Date().toISOString(),
    };

    this.setData({
      result,
      strategyJson: JSON.stringify(payload, null, 2),
      channelLabel: payload.channel,
      timeLabel: payload.timeScene,
      tierLabel: payload.userTier,
    });
  },

  copyStrategy() {
    wx.setClipboardData({
      data: this.data.strategyJson,
      success: () => {
        wx.showToast({
          title: "策略已复制",
          icon: "success",
        });
      },
    });
  },

  savePricing() {
    const plan = JSON.parse(this.data.strategyJson);
    plan.id = Date.now();
    const savedPlans = [plan].concat(this.data.savedPlans).slice(0, 5);
    wx.setStorageSync("pricingPlans", savedPlans);
    this.setData({ savedPlans });
    wx.showToast({
      title: "已保存",
      icon: "success",
    });
  },
});
