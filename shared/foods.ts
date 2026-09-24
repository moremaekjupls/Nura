/**
 * Uzbek-cuisine presets. Values are averaged estimates per one standard
 * portion, not lab data — the UI presents them as such.
 */

export type PortionUnit = 'g' | 'ml' | 'pcs' | 'slice';

export interface PresetFood {
  key: string;
  ru: string;
  uz: string;
  amount: number;
  unit: PortionUnit;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

const f = (key: string, ru: string, uz: string, amount: number, unit: PortionUnit, calories: number, protein: number, fat: number, carbs: number): PresetFood => ({
  key, ru, uz, amount, unit, calories, protein, fat, carbs,
});

export const PRESET_FOODS: PresetFood[] = [
  f('plov', 'Плов', 'Palov', 350, 'g', 650, 22, 28, 70),
  f('manty', 'Манты', 'Manti', 4, 'pcs', 420, 18, 20, 38),
  f('lagman', 'Лагман', 'Lagʻmon', 400, 'g', 480, 20, 16, 58),
  f('shurpa', 'Шурпа', 'Shoʻrva', 350, 'g', 320, 18, 14, 28),
  f('shashlyk', 'Шашлык из баранины', 'Qoʻy goʻshti kabobi', 200, 'g', 430, 32, 32, 2),
  f('samsa', 'Самса', 'Somsa', 1, 'pcs', 290, 9, 18, 22),
  f('non', 'Нон', 'Non', 1, 'pcs', 280, 8, 2, 56),
  f('chuchvara', 'Чучвара', 'Chuchvara', 350, 'g', 380, 16, 14, 48),
  f('dimlama', 'Дымляма', 'Dimlama', 350, 'g', 340, 16, 18, 30),
  f('norin', 'Норин', 'Norin', 300, 'g', 410, 20, 22, 32),
  f('beshbarmak', 'Бешбармак', 'Beshbarmoq', 400, 'g', 520, 30, 24, 44),
  f('tushbera', 'Тушбера', 'Tushbera', 350, 'g', 360, 18, 12, 42),
  f('kaurdak', 'Каурдак', 'Qovurdoq', 250, 'g', 480, 28, 36, 6),
  f('chalop', 'Чалоп', 'Chalop', 300, 'g', 150, 6, 8, 14),
  f('achichuk', 'Ачичук', 'Achchiq-chuchuk', 200, 'g', 60, 2, 0.3, 12),
  f('sumalak', 'Сумаляк', 'Sumalak', 150, 'g', 210, 3, 1, 48),
  f('gudja', 'Гуджа', 'Gʻoja', 200, 'g', 240, 6, 4, 46),
  f('chakchak', 'Чак-чак', 'Chak-chak', 100, 'g', 410, 6, 18, 56),
  f('shirchoy', 'Ширчай', 'Shirchoy', 250, 'ml', 90, 4, 4, 9),
  f('tea_sugar', 'Зелёный чай с сахаром', 'Shakarli koʻk choy', 250, 'ml', 40, 0, 0, 10),
  f('ayran', 'Айран', 'Ayron', 250, 'ml', 110, 6, 6, 8),
  f('coffee_milk', 'Кофе с молоком', 'Sutli qahva', 200, 'ml', 70, 3, 3, 7),
  f('eggs', 'Яичница из 2 яиц', 'Tuxum qovurma, 2 ta', 2, 'pcs', 180, 13, 14, 1),
  f('tvorog', 'Творог с мёдом', 'Asalli tvorog', 150, 'g', 210, 18, 6, 22),
  f('oatmeal', 'Овсянка на воде', 'Suvdagi suli boʻtqasi', 250, 'g', 150, 5, 3, 27),
  f('chicken', 'Куриная грудка гриль', 'Grilda tovuq koʻkragi', 150, 'g', 240, 45, 5, 0),
  f('potato', 'Картофель отварной', 'Qaynatilgan kartoshka', 200, 'g', 160, 4, 0.4, 36),
  f('bread', 'Хлеб белый', 'Oq non', 1, 'slice', 80, 2.5, 0.6, 16),
  f('salad', 'Огурцы и помидоры', 'Bodring va pomidor', 200, 'g', 45, 1.5, 0.3, 8),
  f('melon', 'Дыня', 'Qovun', 300, 'g', 90, 1.5, 0.3, 21),
  f('watermelon', 'Арбуз', 'Tarvuz', 300, 'g', 90, 1.8, 0.3, 21),
  f('grapes', 'Виноград', 'Uzum', 200, 'g', 130, 1.3, 0.3, 32),
  f('apple', 'Яблоко', 'Olma', 1, 'pcs', 80, 0.4, 0.3, 21),
  f('banana', 'Банан', 'Banan', 1, 'pcs', 105, 1.3, 0.4, 27),
];
