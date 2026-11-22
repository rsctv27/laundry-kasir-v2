// Konfigurasi dasar ada di app.json. File ini hanya menambah subpath untuk versi web:
//   EXPO_BASE_URL=/kasir npx expo export --platform web
// menghasilkan aplikasi kasir yang disajikan di https://domain/kasir (satu server dengan web owner dan API).
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...(config.experiments ?? {}), baseUrl } };
};
