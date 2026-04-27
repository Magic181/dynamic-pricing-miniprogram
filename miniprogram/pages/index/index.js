const pricingEngine = require("../../utils/pricingEngine");
const pricingStorage = require("../../utils/pricingStorage");

const defaultForm = {
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
};

const defaultPlan = pricingEngine.calculatePrice(defaultForm);

Page({
  data: {
    channelOptions: pricingEngine.channelOptions,
    timeOptions: pricingEngine.timeOptions,
    tierOptions: pricingEngine.tierOptions,
    form: Object.assign({}, defaultForm),
    plan: defaultPlan,
    savedPlans: [],
    activeTab: "controls",
  },

  onLoad() {
    this.setData({
      savedPlans: pricingStorage.listPlans(),
    });
    this.refreshPrice();
  },

  switchTab(e) {
    this.setData({
      activeTab: e.currentTarget.dataset.key,
    });
  },

  onNumberInput(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch[`form.${field}`] = e.detail.value;
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
      form: Object.assign({}, this.data.form, scenarios[e.currentTarget.dataset.type]),
    }, () => this.refreshPrice());
  },

  resetForm() {
    this.setData({
      form: Object.assign({}, defaultForm),
    }, () => this.refreshPrice());
  },

  refreshPrice() {
    this.setData({
      plan: pricingEngine.calculatePrice(this.data.form),
    });
  },

  copyPlan() {
    wx.setClipboardData({
      data: pricingEngine.buildShareText(this.data.plan),
      success: () => {
        wx.showToast({
          title: "方案已复制",
          icon: "success",
        });
      },
    });
  },

  savePricing() {
    const savedPlans = pricingStorage.savePlan(this.data.plan);
    this.setData({ savedPlans });
    wx.showToast({
      title: "已保存",
      icon: "success",
    });
  },

  clearHistory() {
    wx.showModal({
      title: "清空记录",
      content: "确认删除本机保存的定价记录？",
      success: (res) => {
        if (!res.confirm) return;
        this.setData({
          savedPlans: pricingStorage.clearPlans(),
        });
      },
    });
  },
});
