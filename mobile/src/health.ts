import { Platform } from "react-native";
import { isoDate } from "./normalize";
import type { HealthConnection, HealthMetric, HealthSnapshot } from "./types";

type HealthConnectModule = typeof import("react-native-health-connect");

const RECORDS: Record<
  HealthMetric,
  "Steps" | "RestingHeartRate" | "HeartRateVariabilityRmssd" | "Vo2Max"
> = {
  steps: "Steps",
  restingHeartRate: "RestingHeartRate",
  heartRateVariability: "HeartRateVariabilityRmssd",
  vo2Max: "Vo2Max",
};

const METRIC_LABELS: Record<HealthMetric, string> = {
  steps: "steps",
  restingHeartRate: "resting heart rate",
  heartRateVariability: "heart-rate variability",
  vo2Max: "VO₂ max",
};

function emptyPermissions(): HealthConnection["permissions"] {
  return {
    steps: "not_requested",
    restingHeartRate: "not_requested",
    heartRateVariability: "not_requested",
    vo2Max: "not_requested",
  };
}

function nativeModule(): HealthConnectModule | null {
  if (Platform.OS !== "android") return null;
  try {
    // Kept behind a runtime guard so Expo Go remains usable for non-native UI work.
    return require("react-native-health-connect") as HealthConnectModule;
  } catch {
    return null;
  }
}

function range(days = 30) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    operator: "between" as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

function snapshot(
  metric: HealthMetric,
  date: string,
  value: number,
  unit: HealthSnapshot["unit"],
  source: string,
  metadata: Pick<
    HealthSnapshot,
    | "observedAt"
    | "syncedAt"
    | "aggregation"
    | "windowStart"
    | "windowEnd"
    | "sourceOrigins"
  >,
): HealthSnapshot {
  const observedAt =
    metadata.observedAt ?? metadata.syncedAt ?? new Date().toISOString();
  const syncedAt = metadata.syncedAt ?? new Date().toISOString();
  return {
    id: `health-${metric}-${date}`,
    date,
    metric,
    value,
    unit,
    source,
    ...metadata,
    observedAt,
    syncedAt,
    recordedAt: observedAt,
    available: Number.isFinite(value),
    provenance: { source: "wearable", enteredBy: source, at: syncedAt },
  };
}

async function requestSeparately(health: HealthConnectModule) {
  const permissions = emptyPermissions();
  const errors: HealthMetric[] = [];
  for (const metric of Object.keys(RECORDS) as HealthMetric[]) {
    const recordType = RECORDS[metric];
    try {
      const granted = await health.requestPermission([
        { accessType: "read", recordType },
      ]);
      permissions[metric] = granted.some(
        (permission) =>
          permission.accessType === "read" &&
          permission.recordType === recordType,
      )
        ? "granted"
        : "denied";
    } catch {
      // A failed native prompt is not proof that the member denied access.
      // Keep the state honest and continue offering the other metrics.
      errors.push(metric);
    }
  }
  return { permissions, errors };
}

async function grantedPermissions(health: HealthConnectModule) {
  const granted = await health.getGrantedPermissions();
  return (Object.keys(RECORDS) as HealthMetric[]).reduce<
    HealthConnection["permissions"]
  >((result, metric) => {
    const recordType = RECORDS[metric];
    result[metric] = granted.some(
      (permission) =>
        permission.accessType === "read" &&
        permission.recordType === recordType,
    )
      ? "granted"
      : "denied";
    return result;
  }, emptyPermissions());
}

function latestByTime<T extends { time: string }>(records: T[]): T | undefined {
  return records.reduce<T | undefined>((latest, record) => {
    const recordTime = Date.parse(record.time);
    if (!Number.isFinite(recordTime)) return latest;
    if (!latest) return record;
    const latestTime = Date.parse(latest.time);
    return !Number.isFinite(latestTime) || recordTime > latestTime
      ? record
      : latest;
  }, undefined);
}

async function readStepAggregates(
  health: HealthConnectModule,
  syncedAt: string,
): Promise<HealthSnapshot[]> {
  const snapshots: HealthSnapshot[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const syncDate = new Date(syncedAt);
    const windowEnd = end > syncDate ? syncDate : end;
    const result = await health.aggregateRecord({
      recordType: "Steps",
      timeRangeFilter: {
        operator: "between",
        startTime: start.toISOString(),
        endTime: windowEnd.toISOString(),
      },
    });
    if (typeof result.COUNT_TOTAL === "number") {
      const origins = result.dataOrigins.filter(Boolean);
      snapshots.push(
        snapshot(
          "steps",
          isoDate(start),
          result.COUNT_TOTAL,
          "count",
          origins.join(", ") || "Health Connect",
          {
            observedAt: windowEnd.toISOString(),
            syncedAt,
            aggregation: "daily_sum",
            windowStart: start.toISOString(),
            windowEnd: windowEnd.toISOString(),
            sourceOrigins: origins,
          },
        ),
      );
    }
  }
  return snapshots;
}

async function readLatestRestingHeartRate(
  health: HealthConnectModule,
  syncedAt: string,
): Promise<HealthSnapshot[]> {
  const resting = await health.readRecords("RestingHeartRate", {
    timeRangeFilter: range(),
  });
  const latest = latestByTime(resting.records);
  if (!latest) return [];
  const source = latest.metadata?.dataOrigin || "Health Connect";
  return [
    snapshot(
      "restingHeartRate",
      isoDate(new Date(latest.time)),
      latest.beatsPerMinute,
      "bpm",
      source,
      {
        observedAt: latest.time,
        syncedAt,
        aggregation: "latest_record",
        sourceOrigins: [source],
      },
    ),
  ];
}

async function readLatestHeartRateVariability(
  health: HealthConnectModule,
  syncedAt: string,
): Promise<HealthSnapshot[]> {
  const hrv = await health.readRecords("HeartRateVariabilityRmssd", {
    timeRangeFilter: range(),
  });
  const latest = latestByTime(hrv.records);
  if (!latest) return [];
  const source = latest.metadata?.dataOrigin || "Health Connect";
  return [
    snapshot(
      "heartRateVariability",
      isoDate(new Date(latest.time)),
      latest.heartRateVariabilityMillis,
      "ms",
      source,
      {
        observedAt: latest.time,
        syncedAt,
        aggregation: "latest_record",
        sourceOrigins: [source],
      },
    ),
  ];
}

async function readLatestVo2Max(
  health: HealthConnectModule,
  syncedAt: string,
): Promise<HealthSnapshot[]> {
  const vo2 = await health.readRecords("Vo2Max", {
    timeRangeFilter: range(90),
  });
  const latest = latestByTime(vo2.records);
  if (!latest) return [];
  const source = latest.metadata?.dataOrigin || "Health Connect";
  return [
    snapshot(
      "vo2Max",
      isoDate(new Date(latest.time)),
      latest.vo2MillilitersPerMinuteKilogram,
      "ml/kg/min",
      source,
      {
        observedAt: latest.time,
        syncedAt,
        aggregation: "latest_record",
        sourceOrigins: [source],
      },
    ),
  ];
}

export async function syncHealth(
  requestPermissions: boolean,
): Promise<{ connection: HealthConnection; snapshots: HealthSnapshot[] }> {
  let knownPermissions = emptyPermissions();
  const health = nativeModule();
  if (!health) {
    return {
      connection: {
        platform: Platform.OS === "android" ? "android_health_connect" : "none",
        status: "unavailable",
        syncEnabled: false,
        permissions: knownPermissions,
        message:
          Platform.OS === "android"
            ? "Install the Bharosa development build to connect Health Connect. Expo Go cannot load this native feature."
            : "Health Connect is available on Android. Apple Health support is prepared for a later release.",
      },
      snapshots: [],
    };
  }

  try {
    const status = await health.getSdkStatus();
    if (
      status !== health.SdkAvailabilityStatus.SDK_AVAILABLE ||
      !(await health.initialize())
    ) {
      return {
        connection: {
          platform: "android_health_connect",
          status: "unavailable",
          syncEnabled: false,
          permissions: knownPermissions,
          message:
            "Health Connect is not available or needs an update on this device.",
        },
        snapshots: [],
      };
    }

    const permissionResult = requestPermissions
      ? await requestSeparately(health)
      : { permissions: await grantedPermissions(health), errors: [] };
    const permissions = permissionResult.permissions;
    knownPermissions = permissions;
    const syncTime = new Date().toISOString();
    const snapshots: HealthSnapshot[] = [];
    const readErrors: HealthMetric[] = [...permissionResult.errors];
    const readMetric = async (
      metric: HealthMetric,
      reader: () => Promise<HealthSnapshot[]>,
    ) => {
      if (permissions[metric] !== "granted") return;
      try {
        snapshots.push(...(await reader()));
      } catch {
        readErrors.push(metric);
      }
    };
    await readMetric("steps", () => readStepAggregates(health, syncTime));
    await readMetric("restingHeartRate", () =>
      readLatestRestingHeartRate(health, syncTime),
    );
    await readMetric("heartRateVariability", () =>
      readLatestHeartRateVariability(health, syncTime),
    );
    await readMetric("vo2Max", () => readLatestVo2Max(health, syncTime));
    const grantedCount = Object.values(permissions).filter(
      (value) => value === "granted",
    ).length;
    const failedLabels = [...new Set(readErrors)]
      .map((metric) => METRIC_LABELS[metric])
      .join(", ");
    return {
      connection: {
        platform: "android_health_connect",
        status:
          readErrors.length > 0 && grantedCount > 0
            ? "partial"
            : grantedCount === 4
              ? "connected"
              : grantedCount > 0
                ? "partial"
                : "disconnected",
        syncEnabled: grantedCount > 0,
        permissions,
        lastSyncAt: syncTime,
        message: readErrors.length
          ? grantedCount > 0
            ? `Some Health Connect data could not be refreshed (${failedLabels}). Other available metrics remain usable.`
            : `Health Connect could not finish requesting access to ${failedLabels}. You can retry or manage access in Health Connect.`
          : snapshots.length
            ? undefined
            : grantedCount > 0
              ? "Connected, but no recent data was supplied by your linked apps or devices."
              : undefined,
      },
      snapshots,
    };
  } catch (error) {
    const grantedCount = Object.values(knownPermissions).filter(
      (value) => value === "granted",
    ).length;
    return {
      connection: {
        platform: "android_health_connect",
        status: "error",
        syncEnabled: grantedCount > 0,
        permissions: knownPermissions,
        message:
          error instanceof Error
            ? error.message
            : "Health Connect could not be reached.",
      },
      snapshots: [],
    };
  }
}

export function openHealthSettings() {
  const health = nativeModule();
  if (health) health.openHealthConnectSettings();
}
