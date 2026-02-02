import { useSettings } from '@/contexts/SettingsContext';

type ToastApi = {
  success: (message: string) => void;
};

export function useThemeSettingsViewModel(toast: ToastApi) {
  const { settings, updateTheme, updateColorScheme } = useSettings();

  const handleThemeChange = (newTheme: typeof settings.theme) => {
    updateTheme(newTheme);
    toast.success('主题已更新');
  };

  const handleColorSchemeChange = (newColorScheme: typeof settings.colorScheme) => {
    updateColorScheme(newColorScheme);
    toast.success('颜色方案已更新');
  };

  return {
    theme: settings.theme,
    colorScheme: settings.colorScheme,
    handleThemeChange,
    handleColorSchemeChange,
  };
}
