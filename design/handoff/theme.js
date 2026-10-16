// Дизайн-токены приложения «Намаз» (JS-версия theme.ts)
export const colors = {
  bg: '#0D1613',          // фон экранов
  surface: '#15241F',     // карточки
  surfaceActive: '#1B2F28', // выделенная строка, плашки иконок
  navBg: '#0A110F',       // нижняя панель
  border: '#243630',      // рамка карточек
  borderSoft: '#1E2E28',  // рамка строк списка, разделители
  borderStrong: '#2C4238',// арки, пилюли, неактивные точки
  text: '#EDE6D6',
  textDim: '#C9C2B2',     // прошедшие времена в списке
  muted: '#8FA89E',       // подписи, неактивные иконки
  accent: '#E3BE72',      // единственный акцент (золото)
  star: '#3A5448',
  onAccent: '#0D1613',    // текст на золотом фоне
};

export const radii = { hero: 28, card: 22, row: 18, button: 14, iconBox: 12, pill: 999 };

export const spacing = { screenX: 20, gap: 6, section: 16, navHeight: 76 };

// Шрифты: @expo-google-fonts/manrope, cormorant-garamond, amiri
export const fonts = {
  ui: { regular: 'Manrope_400Regular', medium: 'Manrope_500Medium', semibold: 'Manrope_600SemiBold', bold: 'Manrope_700Bold', extrabold: 'Manrope_800ExtraBold' },
  serif: { medium: 'CormorantGaramond_500Medium', semibold: 'CormorantGaramond_600SemiBold' }, // слоганы, аяты
  arabic: { regular: 'Amiri_400Regular', bold: 'Amiri_700Bold', quran: 'AmiriQuran_400Regular' },
};

export const type = {
  screenTitle: { fontFamily: fonts.ui.bold, fontSize: 28, letterSpacing: -0.3 },
  heroTime: { fontFamily: fonts.ui.bold, fontSize: 68, letterSpacing: -2 },
  heroName: { fontFamily: fonts.serif.semibold, fontSize: 40 },
  label: { fontFamily: fonts.ui.semibold, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }, // золотая надпись-подпись
  rowTitle: { fontFamily: fonts.ui.medium, fontSize: 16 },
  rowTime: { fontFamily: fonts.ui.semibold, fontSize: 17 }, // + fontVariant: ['tabular-nums']
  caption: { fontFamily: fonts.ui.regular, fontSize: 13 },
  tab: { fontFamily: fonts.ui.semibold, fontSize: 11 },
};
