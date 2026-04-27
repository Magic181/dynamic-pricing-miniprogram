const channelOptions = ["到店自取", "即时配送", "预约服务", "线上虚拟商品"];
const timeOptions = ["工作日白天", "工作日晚高峰", "周末", "节假日"];
const tierOptions = ["普通用户", "银卡会员", "金卡会员", "新客"];

const channelFactorMap = [0.98, 1.04, 1.02, 0.94];
const timeFactorMap = [1, 1.08, 1.06, 1.15];
const tierDiscountMap = [0, 0.03, 0.06, 0.08];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
  return Number(value) || 0;
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function percent(value) {
  return Number(value || 0).toFixed(1);
}

function normalizeForm(form) {
  return {
    productName: form.productName || "未命名商品",
    cost: toNumber(form.cost),
    basePrice: toNumber(form.basePrice),
    competitorPrice: toNumber(form.competitorPrice),
    targetMargin: clamp(toNumber(form.targetMargin), 5, 80),
    inventory: clamp(toNumber(form.inventory), 0, 100),
    demand: clamp(toNumber(form.demand), 0, 100),
    channelIndex: Math.round(clamp(toNumber(form.channelIndex), 0, channelOptions.length - 1)),
    timeIndex: Math.round(clamp(toNumber(form.timeIndex), 0, timeOptions.length - 1)),
    tierIndex: Math.round(clamp(toNumber(form.tierIndex), 0, tierOptions.length - 1)),
  };
}

function buildWarnings(input) {
  const warnings = [];

  if (input.cost <= 0) warnings.push("请填写有效成本，保护价依赖成本计算。");
  if (input.basePrice <= 0) warnings.push("请填写基准价，否则建议价会缺少业务锚点。");
  if (input.competitorPrice > 0 && input.competitorPrice < input.cost) {
    warnings.push("竞品价低于成本，建议检查数据或避免盲目跟价。");
  }

  return warnings;
}

function calculatePrice(form) {
  const input = normalizeForm(form);
  const minPrice = input.cost / (1 - input.targetMargin / 100);
  const demandFactor = 1 + (input.demand - 50) * 0.006;
  const inventoryFactor =
    input.inventory < 25 ? 1 + (25 - input.inventory) * 0.008 : 1 - (input.inventory - 25) * 0.0025;
  const marketAnchor =
    input.competitorPrice > 0 ? input.basePrice * 0.65 + input.competitorPrice * 0.35 : input.basePrice;
  const channelFactor = channelFactorMap[input.channelIndex];
  const timeFactor = timeFactorMap[input.timeIndex];
  const tierDiscount = tierDiscountMap[input.tierIndex];
  const rawPrice = marketAnchor * demandFactor * inventoryFactor * timeFactor * channelFactor;
  const discountedPrice = rawPrice * (1 - tierDiscount);
  const ceiling = input.competitorPrice > 0 ? input.competitorPrice * 1.18 : input.basePrice * 1.45;
  const suggestedPrice = clamp(discountedPrice, minPrice, Math.max(minPrice, ceiling));
  const profit = suggestedPrice - input.cost;
  const margin = suggestedPrice > 0 ? (profit / suggestedPrice) * 100 : 0;
  const expectedRevenue = suggestedPrice * input.demand;
  const baseDelta = input.basePrice > 0 ? ((suggestedPrice - input.basePrice) / input.basePrice) * 100 : 0;

  return {
    id: Date.now(),
    productName: input.productName,
    labels: {
      channel: channelOptions[input.channelIndex],
      timeScene: timeOptions[input.timeIndex],
      userTier: tierOptions[input.tierIndex],
    },
    input,
    output: {
      suggestedPrice: money(suggestedPrice),
      minPrice: money(minPrice),
      maxPrice: money(Math.max(minPrice, ceiling)),
      profit: money(profit),
      margin: money(margin),
      expectedRevenue: money(expectedRevenue),
      baseDelta: percent(baseDelta),
    },
    factors: [
      { name: "需求", value: input.demand, effect: percent((demandFactor - 1) * 100) + "%" },
      { name: "库存", value: input.inventory, effect: percent((inventoryFactor - 1) * 100) + "%" },
      { name: "时段", value: timeOptions[input.timeIndex], effect: percent((timeFactor - 1) * 100) + "%" },
      { name: "渠道", value: channelOptions[input.channelIndex], effect: percent((channelFactor - 1) * 100) + "%" },
      { name: "会员", value: tierOptions[input.tierIndex], effect: "-" + percent(tierDiscount * 100) + "%" },
    ],
    reasons: [
      input.demand >= 70 ? "需求偏高，建议提高价格捕捉峰值收益。" : input.demand <= 35 ? "需求偏弱，建议保持价格克制。" : "需求稳定，围绕基准价微调。",
      input.inventory <= 25 ? "库存紧张，加入稀缺性溢价。" : input.inventory >= 75 ? "库存充足，适度让利促进转化。" : "库存健康，维持平衡策略。",
      "保护价保证目标毛利率，上限价避免明显脱离市场。",
    ],
    warnings: buildWarnings(input),
    updatedAt: new Date().toISOString(),
  };
}

function buildShareText(plan) {
  return [
    `${plan.productName} 动态定价方案`,
    `建议售价：¥${plan.output.suggestedPrice}`,
    `价格区间：¥${plan.output.minPrice} - ¥${plan.output.maxPrice}`,
    `单件利润：¥${plan.output.profit}，利润率：${plan.output.margin}%`,
    `场景：${plan.labels.timeScene} / ${plan.labels.channel} / ${plan.labels.userTier}`,
  ].join("\n");
}

module.exports = {
  channelOptions,
  timeOptions,
  tierOptions,
  calculatePrice,
  buildShareText,
};
