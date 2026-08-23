const isDevelopmentBuild =
  process.env.BHAROSA_APP_VARIANT === "development";

module.exports = ({ config }) => ({
  ...config,
  name: isDevelopmentBuild ? "Bharosa Wellness Dev" : config.name,
  ios: {
    ...config.ios,
    bundleIdentifier: isDevelopmentBuild
      ? `${config.ios.bundleIdentifier}.dev`
      : config.ios.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: isDevelopmentBuild
      ? `${config.android.package}.dev`
      : config.android.package,
  },
});
