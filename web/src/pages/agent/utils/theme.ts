export const getTheme = (): 'dark' | 'light' => {
  return (document.body.getAttribute('data-theme') || 'dark') as 'dark' | 'light';
};
