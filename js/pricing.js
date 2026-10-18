// Расчёт стоимости и срока доставки – этап BPMN 6 «Рассчитать стоимость и срок доставки».
// Тарифная модель совпадает с Telegram-ботом (logihub_bot/pricing.py) и выгрузкой дашборда.

export const HUB = "Комсомольск-на-Амуре";
export const HUB_ADDRESS = "Комсомольск-на-Амуре, ул. Заводская, 1 (склад ЛогиХаб)";

export const DESTINATIONS = {          // город: [регион, расстояние от хаба, км]
  "Хабаровск": ["Хабаровский край", 400],
  "Биробиджан": ["Еврейская АО", 560],
  "Владивосток": ["Приморский край", 1050],
  "Благовещенск": ["Амурская область", 1350],
  "Южно-Сахалинск": ["Сахалинская область", 1600],
};

export const CARGO = {                 // категория: коэффициент тарифа
  "Продукты питания": 1.10,
  "Электроника": 1.25,
  "Стройматериалы": 0.95,
  "Одежда и обувь": 1.05,
  "Мебель": 1.10,
  "Медикаменты": 1.30,
};

export const TEMPERATURE = { "Продукты питания": "+2…+6 °C", "Медикаменты": "+2…+8 °C" };

export const TRANSPORT = {             // тип: [грузоподъёмность, кг; скорость, км/ч; тариф, руб/км]
  "Газель": [1500, 60, 32],
  "Фура": [20000, 55, 75],
  "Рефрижератор": [12000, 52, 88],
  "Контейнер (ж/д)": [24000, 40, 55],
};

export const MAX_WEIGHT_KG = 24000;
export const KG_RATE = 0.8;
export const BASE_FEE = 3000;
export const INSURANCE_RATE = 0.003;
export const INSURANCE_MIN = 300;
export const VAT = 0.2;

export class PricingError extends Error {}

const round10 = (x) => Math.round(x / 10) * 10;

export function chooseTransport(cargo, weight) {
  if (weight > MAX_WEIGHT_KG) throw new PricingError(`Вес превышает максимальную грузоподъёмность ${MAX_WEIGHT_KG.toLocaleString("ru")} кг`);
  if (TEMPERATURE[cargo] && weight <= TRANSPORT["Рефрижератор"][0]) return "Рефрижератор";
  if (weight <= TRANSPORT["Газель"][0]) return "Газель";
  if (weight > TRANSPORT["Фура"][0]) return "Контейнер (ж/д)";
  return "Фура";
}

export function insuranceFor(declared) {
  if (!(declared > 0)) return 0;
  return Math.max(INSURANCE_MIN, round10(declared * INSURANCE_RATE));
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Расчёт заявки. shipDate – Date или строка YYYY-MM-DD. */
export function quote({ destination, cargo, weight, shipDate, declared = 0 }) {
  if (!DESTINATIONS[destination]) throw new PricingError(`Направление «${destination}» не обслуживается`);
  if (!CARGO[cargo]) throw new PricingError(`Неизвестная категория груза «${cargo}»`);
  if (!(weight > 0)) throw new PricingError("Вес груза должен быть больше нуля");
  if (declared < 0) throw new PricingError("Объявленная стоимость не может быть отрицательной");
  const [region, distance] = DESTINATIONS[destination];
  const transport = chooseTransport(cargo, weight);
  const [, speed, rate] = TRANSPORT[transport];
  const distanceFee = round10(distance * rate * CARGO[cargo]);
  const weightFee = round10(weight * KG_RATE);
  const price = round10(distance * rate * CARGO[cargo] + weight * KG_RATE + BASE_FEE);
  const days = Math.max(1, Math.round(distance / (speed * 10)) + 1);
  const ship = new Date(shipDate);
  const insurance = insuranceFor(declared);
  return {
    destination, region, cargo, weight, transport, distance, price, distanceFee, weightFee, baseFee: BASE_FEE,
    declared, insurance, total: price + insurance, temperature: TEMPERATURE[cargo] || null,
    shipDate: ship, eta: addDays(ship, days), days,
  };
}
