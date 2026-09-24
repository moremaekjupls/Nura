/**
 * Russian and Uzbek (Latin) UI strings. The Uzbek copy is a first draft and
 * should be reviewed by a native speaker before a marketing launch.
 */
import { createContext, useContext } from 'react';

const ru = {
  'app.tagline': 'Калории и БЖУ — спокойно, без осуждения',
  'common.save': 'Сохранить', 'common.cancel': 'Отмена', 'common.close': 'Закрыть', 'common.delete': 'Удалить',
  'common.undo': 'Отменить', 'common.edit': 'Изменить', 'common.done': 'Готово', 'common.add': 'Добавить',
  'common.retry': 'Повторить', 'common.offline': 'Нет соединения. Проверьте интернет', 'common.error': 'Что-то пошло не так',
  'unit.kcal': 'ккал', 'unit.g': 'г', 'unit.ml': 'мл', 'unit.l': 'л', 'unit.kg': 'кг', 'unit.pcs': 'шт', 'unit.slice': 'кусок', 'unit.cm': 'см',
  'meal.breakfast': 'Завтрак', 'meal.lunch': 'Обед', 'meal.dinner': 'Ужин', 'meal.snack': 'Перекус',
  'mealLower.breakfast': 'завтрак', 'mealLower.lunch': 'обед', 'mealLower.dinner': 'ужин', 'mealLower.snack': 'перекус',
  'meal.addRow': 'Добавить {meal}',
  'tab.today': 'Сегодня', 'tab.progress': 'Прогресс', 'tab.profile': 'Профиль', 'tab.add': 'Добавить еду',

  'auth.login': 'Вход', 'auth.register': 'Регистрация', 'auth.email': 'Email', 'auth.password': 'Пароль',
  'auth.passwordHint': 'Не короче 8 символов', 'auth.consentA': 'Соглашаюсь с ', 'auth.consentLink': 'политикой конфиденциальности',
  'auth.consentB': '', 'auth.submitLogin': 'Войти', 'auth.submitRegister': 'Создать аккаунт',
  'auth.tgLoading': 'Входим через Telegram…', 'auth.tgFailed': 'Не удалось войти через Telegram. Войдите по email',
  'auth.needConsent': 'Нужно согласие с политикой',

  'today.title': 'Сегодня', 'today.yesterday': 'Вчера', 'today.left': 'ккал осталось', 'today.over': 'ккал сверх цели',
  'today.eaten': 'Съедено', 'today.goal': 'Цель', 'macro.protein': 'Белки', 'macro.fat': 'Жиры', 'macro.carbs': 'Углеводы',
  'macro.p': 'Б', 'macro.f': 'Ж', 'macro.c': 'У',
  'today.water': 'Вода', 'today.waterOf': '{a} из {b} л', 'today.cup': 'Стакан {n}', 'today.prevWeek': 'Предыдущая неделя',
  'today.nextWeek': 'Следующая неделя', 'today.banner': 'Заполните профиль — посчитаем вашу норму', 'today.deleted': 'Удалено: {name}',
  'today.added': 'Добавлено в {meal} · {kcal} ккал',

  'add.title': 'Добавить', 'add.search': 'Плов, самса, шурпа…', 'add.photo': 'Фото блюда', 'add.photoSub': 'ИИ оценит порцию',
  'add.describe': 'Описать словами', 'add.describeSub': '«самса и чай с сахаром»',
  'add.describePh': 'Например: плов 300 г, ачичук и чай', 'add.recognize': 'Распознать', 'add.recognizing': 'Распознаём…',
  'add.aiNothing': 'Еда не найдена', 'add.aiApprox': 'Оценка ИИ приблизительная — проверьте порции',
  'add.selected': 'Выбрано', 'add.frequent': 'Вы часто едите', 'add.cuisine': 'Узбекская кухня', 'add.manual': 'Ввести вручную',
  'add.notFound': 'Не нашли? Опишите блюдо словами — ИИ посчитает', 'add.pick': 'Выберите блюда',
  'add.cta': 'Добавить · {kcal} ккал', 'add.name': 'Название', 'add.portion': 'Порция', 'add.calories': 'Калории',
  'add.toList': 'В список', 'add.less': 'Меньше: {name}', 'add.more': 'Больше: {name}', 'add.addItem': 'Добавить {name}',
  'add.estimate': 'Значения — средние оценки на порцию',

  'entry.title': 'Запись', 'entry.meal': 'Приём пищи',

  'progress.title': 'Прогресс', 'progress.weight': 'Вес', 'progress.weightEmpty': 'Запишите вес — появится график',
  'progress.record': 'Записать', 'progress.weightSaved': 'Вес записан · {kg} кг', 'progress.since': 'с {date}',
  'progress.cal7': 'Калории · 7 дней', 'progress.avg': 'в среднем', 'progress.streak': 'Серия', 'progress.days': 'дн.',
  'progress.streakSub': 'подряд с записями', 'progress.waterAvg': 'л/день', 'progress.waterSub': 'вода, среднее за 7 дней',
  'progress.dec': 'Уменьшить на 0,1 кг', 'progress.inc': 'Увеличить на 0,1 кг',

  'profile.title': 'Профиль', 'profile.body': 'Параметры', 'profile.gender': 'Пол', 'profile.male': 'Мужской', 'profile.female': 'Женский',
  'profile.birthYear': 'Год рождения', 'profile.height': 'Рост', 'profile.weight': 'Вес', 'profile.name': 'Имя',
  'profile.dailyGoal': 'Дневная норма', 'profile.formula': 'По формуле Миффлина — Сан Жеора из ваших параметров',
  'profile.manualNote': 'Своя цель: не меняется при изменении веса',
  'profile.goalMode': 'Цель', 'goal.lose': 'Похудеть', 'goal.keep': 'Держать', 'goal.gain': 'Набрать',
  'profile.activity': 'Активность', 'act.low': 'Низкая', 'act.mid': 'Средняя', 'act.high': 'Высокая',
  'act.lowHint': 'Сидячая работа, мало ходьбы', 'act.midHint': 'Тренировки 3–4 раза в неделю или много ходьбы',
  'act.highHint': 'Физическая работа или спорт почти каждый день',
  'profile.auto': 'Считать автоматически', 'profile.water': 'Вода', 'profile.fill': 'Заполнить профиль',
  'profile.editGoal': 'Изменить норму', 'profile.editBody': 'Изменить параметры',
  'profile.settings': 'Настройки', 'profile.language': 'Язык', 'profile.export': 'Экспорт данных',
  'profile.changePassword': 'Сменить пароль', 'profile.currentPassword': 'Текущий пароль', 'profile.newPassword': 'Новый пароль',
  'profile.passwordChanged': 'Пароль изменён', 'profile.privacy': 'Конфиденциальность', 'profile.logout': 'Выйти',
  'profile.deleteAccount': 'Удалить аккаунт', 'profile.deleteConfirm': 'Все записи, вес и профиль будут удалены без возможности восстановления.',
  'profile.deleteForever': 'Удалить навсегда', 'profile.viaTelegram': 'Вход через Telegram', 'profile.saved': 'Сохранено',
  'profile.years': '{n} лет',

  'onb.title': 'Расскажите о себе', 'onb.sub': 'Посчитаем дневную норму калорий и БЖУ под вас. Данные видите только вы.',
  'onb.result': 'Ваша норма', 'onb.start': 'Начать', 'onb.skip': 'Позже',
};

type Key = keyof typeof ru;

const uz: Record<Key, string> = {
  'app.tagline': 'Kaloriya va BJU — xotirjam, hukmsiz',
  'common.save': 'Saqlash', 'common.cancel': 'Bekor qilish', 'common.close': 'Yopish', 'common.delete': 'Oʻchirish',
  'common.undo': 'Qaytarish', 'common.edit': 'Tahrirlash', 'common.done': 'Tayyor', 'common.add': 'Qoʻshish',
  'common.retry': 'Qayta urinish', 'common.offline': 'Aloqa yoʻq. Internetni tekshiring', 'common.error': 'Nimadir xato ketdi',
  'unit.kcal': 'kkal', 'unit.g': 'g', 'unit.ml': 'ml', 'unit.l': 'l', 'unit.kg': 'kg', 'unit.pcs': 'dona', 'unit.slice': 'boʻlak', 'unit.cm': 'sm',
  'meal.breakfast': 'Nonushta', 'meal.lunch': 'Tushlik', 'meal.dinner': 'Kechki ovqat', 'meal.snack': 'Tamaddi',
  'mealLower.breakfast': 'nonushta', 'mealLower.lunch': 'tushlik', 'mealLower.dinner': 'kechki ovqat', 'mealLower.snack': 'tamaddi',
  'meal.addRow': '{meal} qoʻshish',
  'tab.today': 'Bugun', 'tab.progress': 'Natijalar', 'tab.profile': 'Profil', 'tab.add': 'Ovqat qoʻshish',

  'auth.login': 'Kirish', 'auth.register': 'Roʻyxatdan oʻtish', 'auth.email': 'Email', 'auth.password': 'Parol',
  'auth.passwordHint': 'Kamida 8 ta belgi', 'auth.consentA': '', 'auth.consentLink': 'Maxfiylik siyosati',
  'auth.consentB': 'ga roziman', 'auth.submitLogin': 'Kirish', 'auth.submitRegister': 'Hisob yaratish',
  'auth.tgLoading': 'Telegram orqali kirilmoqda…', 'auth.tgFailed': 'Telegram orqali kirib boʻlmadi. Email orqali kiring',
  'auth.needConsent': 'Siyosatga rozilik kerak',

  'today.title': 'Bugun', 'today.yesterday': 'Kecha', 'today.left': 'kkal qoldi', 'today.over': 'kkal meʼyordan ortiq',
  'today.eaten': 'Yeyildi', 'today.goal': 'Maqsad', 'macro.protein': 'Oqsil', 'macro.fat': 'Yogʻ', 'macro.carbs': 'Uglevod',
  'macro.p': 'O', 'macro.f': 'Y', 'macro.c': 'U',
  'today.water': 'Suv', 'today.waterOf': '{a} / {b} l', 'today.cup': '{n}-stakan', 'today.prevWeek': 'Oldingi hafta',
  'today.nextWeek': 'Keyingi hafta', 'today.banner': 'Profilni toʻldiring — meʼyoringizni hisoblaymiz', 'today.deleted': 'Oʻchirildi: {name}',
  'today.added': '{meal}: +{kcal} kkal',

  'add.title': 'Qoʻshish', 'add.search': 'Palov, somsa, shoʻrva…', 'add.photo': 'Suratga olish', 'add.photoSub': 'SI porsiyani baholaydi',
  'add.describe': 'Soʻz bilan yozish', 'add.describeSub': '«somsa va shakarli choy»',
  'add.describePh': 'Masalan: 300 g palov, achchiq-chuchuk va choy', 'add.recognize': 'Aniqlash', 'add.recognizing': 'Aniqlanmoqda…',
  'add.aiNothing': 'Ovqat topilmadi', 'add.aiApprox': 'SI bahosi taxminiy — porsiyalarni tekshiring',
  'add.selected': 'Tanlangan', 'add.frequent': 'Tez-tez yeysiz', 'add.cuisine': 'Oʻzbek taomlari', 'add.manual': 'Qoʻlda kiritish',
  'add.notFound': 'Topilmadimi? Taomni soʻz bilan yozing — SI hisoblaydi', 'add.pick': 'Taomlarni tanlang',
  'add.cta': 'Qoʻshish · {kcal} kkal', 'add.name': 'Nomi', 'add.portion': 'Porsiya', 'add.calories': 'Kaloriya',
  'add.toList': 'Roʻyxatga', 'add.less': 'Kamroq: {name}', 'add.more': 'Koʻproq: {name}', 'add.addItem': '{name} qoʻshish',
  'add.estimate': 'Qiymatlar — bir porsiya uchun oʻrtacha baho',

  'entry.title': 'Yozuv', 'entry.meal': 'Ovqatlanish',

  'progress.title': 'Natijalar', 'progress.weight': 'Vazn', 'progress.weightEmpty': 'Vazningizni yozing — grafik paydo boʻladi',
  'progress.record': 'Yozish', 'progress.weightSaved': 'Vazn yozildi · {kg} kg', 'progress.since': '{date} dan',
  'progress.cal7': 'Kaloriya · 7 kun', 'progress.avg': 'oʻrtacha', 'progress.streak': 'Ketma-ketlik', 'progress.days': 'kun',
  'progress.streakSub': 'uzluksiz yozuvlar', 'progress.waterAvg': 'l/kun', 'progress.waterSub': 'suv, 7 kunlik oʻrtacha',
  'progress.dec': '0,1 kg kamaytirish', 'progress.inc': '0,1 kg koʻpaytirish',

  'profile.title': 'Profil', 'profile.body': 'Parametrlar', 'profile.gender': 'Jins', 'profile.male': 'Erkak', 'profile.female': 'Ayol',
  'profile.birthYear': 'Tugʻilgan yil', 'profile.height': 'Boʻy', 'profile.weight': 'Vazn', 'profile.name': 'Ism',
  'profile.dailyGoal': 'Kunlik meʼyor', 'profile.formula': 'Parametrlaringiz asosida Mifflin — San Jeor formulasi boʻyicha',
  'profile.manualNote': 'Oʻz maqsadingiz: vazn oʻzgarsa ham oʻzgarmaydi',
  'profile.goalMode': 'Maqsad', 'goal.lose': 'Ozish', 'goal.keep': 'Saqlash', 'goal.gain': 'Vazn olish',
  'profile.activity': 'Faollik', 'act.low': 'Past', 'act.mid': 'Oʻrta', 'act.high': 'Yuqori',
  'act.lowHint': 'Oʻtirib ishlash, kam yurish', 'act.midHint': 'Haftasiga 3–4 mashgʻulot yoki koʻp yurish',
  'act.highHint': 'Jismoniy mehnat yoki deyarli har kuni sport',
  'profile.auto': 'Avtomatik hisoblash', 'profile.water': 'Suv', 'profile.fill': 'Profilni toʻldirish',
  'profile.editGoal': 'Meʼyorni tahrirlash', 'profile.editBody': 'Parametrlarni tahrirlash',
  'profile.settings': 'Sozlamalar', 'profile.language': 'Til', 'profile.export': 'Maʼlumotlarni yuklab olish',
  'profile.changePassword': 'Parolni oʻzgartirish', 'profile.currentPassword': 'Joriy parol', 'profile.newPassword': 'Yangi parol',
  'profile.passwordChanged': 'Parol oʻzgartirildi', 'profile.privacy': 'Maxfiylik', 'profile.logout': 'Chiqish',
  'profile.deleteAccount': 'Hisobni oʻchirish', 'profile.deleteConfirm': 'Barcha yozuvlar, vazn va profil qaytarib boʻlmaydigan tarzda oʻchiriladi.',
  'profile.deleteForever': 'Butunlay oʻchirish', 'profile.viaTelegram': 'Telegram orqali kirilgan', 'profile.saved': 'Saqlandi',
  'profile.years': '{n} yosh',

  'onb.title': 'Oʻzingiz haqingizda', 'onb.sub': 'Sizga mos kunlik kaloriya va BJU meʼyorini hisoblaymiz. Maʼlumotlarni faqat siz koʻrasiz.',
  'onb.result': 'Sizning meʼyoringiz', 'onb.start': 'Boshlash', 'onb.skip': 'Keyinroq',
};

export type Lang = 'ru' | 'uz';
export type T = (key: Key, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): T {
  const dict = lang === 'uz' ? uz : ru;
  return (key, vars) => {
    let s = dict[key] ?? ru[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}

/** Uzbek uses the same number conventions as Russian (space thousands, decimal comma). */
export const locale = (_lang: Lang) => 'ru-RU';

const UZ_WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const UZ_WEEKDAYS_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

function uzDate(d: Date, o: Intl.DateTimeFormatOptions): string {
  const parts: string[] = [];
  if (o.weekday) parts.push(o.weekday === 'short' ? UZ_WEEKDAYS_SHORT[d.getDay()] : UZ_WEEKDAYS[d.getDay()]);
  if (o.day && o.month) {
    const m = UZ_MONTHS[d.getMonth()];
    parts.push(`${d.getDate()}-${o.month === 'short' ? m.slice(0, 3) : m}`);
  }
  return parts.join(', ');
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface I18n {
  lang: Lang;
  t: T;
  num: (n: number, digits?: number) => string;
  date: (iso: string, opts: Intl.DateTimeFormatOptions) => string;
}

export function makeI18n(lang: Lang): I18n {
  const loc = locale(lang);
  return {
    lang,
    t: makeT(lang),
    num: (n, digits = 0) => n.toLocaleString(loc, { maximumFractionDigits: digits, minimumFractionDigits: digits }),
    date: (iso, opts) => {
      const [y, m, d] = iso.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return lang === 'uz' ? uzDate(date, opts) : date.toLocaleDateString(loc, opts);
    },
  };
}

export const I18nContext = createContext<I18n>(makeI18n('ru'));
export const useI18n = () => useContext(I18nContext);
