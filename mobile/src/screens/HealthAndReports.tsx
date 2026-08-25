import { useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Share, Switch, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { HeartPulse, RefreshCw, ShieldCheck } from "lucide-react-native";
import { DEMO_TOKEN, uploadMemberFile } from "../api";
import { HEALTH_LABELS } from "../content";
import { CONNECTED_HEALTH_NAME } from "../health";
import { s } from "../design/styles";
import { C } from "../design/tokens";
import { openHealthSettings, syncHealth } from "../health";
import { newId } from "../ids";
import { type HealthMetric, type MemberDoc } from "../types";
import { Card } from "../ui";

export function Reports({
  doc,
  update,
  token,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  token: string;
}) {
  const [category, setCategory] = useState<"blood_work" | "body_composition">(
    "blood_work",
  );
  const [uploading, setUploading] = useState(false);
  const upload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      const stored = await uploadMemberFile(
        token,
        { uri: asset.uri, name: asset.name, type: asset.mimeType },
        "report",
      );
      update({
        ...doc,
        reports: [
          ...doc.reports,
          {
            id: newId("report"),
            memberId: doc.member.id,
            title:
              category === "blood_work" ? "Blood work" : "Body composition",
            category,
            fileName: asset.name,
            fileId: stored?.id,
            fileUri: token === DEMO_TOKEN ? asset.uri : undefined,
            uploadedAt: new Date().toISOString(),
            status: "uploaded",
          },
        ],
      });
    } catch (error) {
      Alert.alert(
        "Report not saved",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <Card>
      <View style={s.rowBetween}>
        <View style={s.flex}>
          <Text style={s.cardTitle}>Your documents</Text>
          <Text style={s.profileCopy}>
            Blood work, scans and letters, kept where you can find them.
          </Text>
        </View>
        <Text style={s.reportCount}>{doc.reports.length}</Text>
      </View>
      <View style={s.reportCategories}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: category === "blood_work" }}
          onPress={() => setCategory("blood_work")}
          style={[
            s.reportCategory,
            category === "blood_work" && s.reportCategoryActive,
          ]}
        >
          <Text
            style={[
              s.reportCategoryText,
              category === "blood_work" && s.reportCategoryTextActive,
            ]}
          >
            Blood work
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: category === "body_composition" }}
          onPress={() => setCategory("body_composition")}
          style={[
            s.reportCategory,
            category === "body_composition" && s.reportCategoryActive,
          ]}
        >
          <Text
            style={[
              s.reportCategoryText,
              category === "body_composition" && s.reportCategoryTextActive,
            ]}
          >
            Body composition
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [s.uploadButton, pressed && s.pressed]}
        onPress={upload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={C.greenDeep} />
        ) : (
          <Text style={s.uploadButtonText}>Choose PDF or photo</Text>
        )}
      </Pressable>
      {doc.reports
        .slice(-3)
        .reverse()
        .map((report) => (
          <View key={report.id} style={s.reportRow}>
            <View style={s.reportFileIcon}>
              <Text style={s.reportFileText}>FILE</Text>
            </View>
            <View style={s.reportText}>
              <Text numberOfLines={1} style={s.reportName}>
                {report.fileName}
              </Text>
              <Text style={s.reportMeta}>
                {report.title} ·{" "}
                {new Date(report.uploadedAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={s.reportStatus}>
              {report.fileId ? "Saved privately" : "On this device"}
            </Text>
          </View>
        ))}
      {/*
        What this actually is.

        It used to say "stores the report for coach review", which was not
        true in either direction: nothing in the app or the coach console
        reads these files, and most members have no coach at all. Someone
        uploading her blood work was being told a person would look at it.

        It is a private place to keep documents. That is genuinely useful —
        having your last panel on your phone in a waiting room is worth
        something — but it is worth exactly what it is.
      */}
      <Text style={s.reportPrivacy}>
        These are stored privately for you. Bharosa does not read, interpret
        or act on them, and nothing here changes your plan. They are here so
        you have them when you need them — to show a doctor, or your coach.
      </Text>
    </Card>
  );
}

export function HealthConnectionPanel({
  doc,
  update,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const connection = doc.healthConnection;
  const providerName = CONNECTED_HEALTH_NAME;
  const mergeSnapshots = (incoming: MemberDoc["healthSnapshots"]) => {
    const map = new Map(doc.healthSnapshots.map((item) => [item.id, item]));
    incoming.forEach((item) => map.set(item.id, item));
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  };
  const runSync = async (requestPermissions: boolean) => {
    setSyncing(true);
    try {
      const result = await syncHealth(requestPermissions);
      await update({
        ...doc,
        healthConnection: result.connection,
        healthSnapshots: mergeSnapshots(result.snapshots),
      });
    } catch (error) {
      // A throw here used to leave the spinner turning with nothing said, so
      // the screen looked busy indefinitely and there was no way to tell a
      // slow sync from a broken one.
      Alert.alert(
        "Could not sync",
        error instanceof Error
          ? error.message
          : "Your health source did not respond. Your plan is unaffected.",
      );
    } finally {
      setSyncing(false);
    }
  };
  const toggle = (enabled: boolean) =>
    enabled
      ? runSync(true)
      : update({
          ...doc,
          healthConnection: {
            ...connection,
            syncEnabled: false,
            status: "disconnected",
            message:
              "Sync is paused. Existing snapshots remain in your Bharosa history.",
          },
        });
  const latest = (Object.keys(HEALTH_LABELS) as HealthMetric[]).map(
    (metric) => ({
      metric,
      snapshot: [...doc.healthSnapshots]
        .reverse()
        .find((item) => item.metric === metric && item.available),
    }),
  );
  return (
    <>
      <Text style={s.sectionTitle}>Connected health</Text>
      <Card style={s.healthCard}>
        <View style={s.healthHeader}>
          <View
            style={[
              s.healthIcon,
              connection.status === "connected" && s.healthIconConnected,
            ]}
          >
            <HeartPulse
              size={23}
              color={connection.status === "connected" ? "white" : C.greenDeep}
            />
          </View>
          <View style={s.flex}>
            <Text style={s.cardTitle}>{providerName}</Text>
            <Text style={s.healthStatus}>
              {connection.status === "connected"
                ? "Connected"
                : connection.status === "partial"
                  ? "Partially connected"
                  : connection.status === "unavailable"
                    ? `${Platform.OS === "ios" ? "iOS" : "Android"} build required`
                    : "Not connected"}
            </Text>
          </View>
          <Switch
            value={connection.syncEnabled}
            onValueChange={toggle}
            disabled={syncing}
            trackColor={{ false: C.line, true: C.greenTint }}
            thumbColor={connection.syncEnabled ? C.green : C.faint}
          />
        </View>
        <Text style={s.profileCopy}>
          Bharosa reads only the metrics you approve. Availability depends on
          the phone, connected apps and wearable hardware.
          {Platform.OS === "ios"
            ? " iOS keeps individual read decisions private, so Bharosa shows Requested rather than claiming access was granted."
            : ""}
        </Text>
        {connection.message && (
          <View style={s.healthMessage}>
            <Text style={s.healthMessageText}>{connection.message}</Text>
          </View>
        )}
        <View style={s.permissionGrid}>
          {latest.map(({ metric, snapshot }) => (
            <View key={metric} style={s.permissionItem}>
              <View style={s.rowBetween}>
                <Text style={s.permissionLabel}>
                  {HEALTH_LABELS[metric].label}
                </Text>
                <Text
                  style={[
                    s.permissionState,
                    ["granted", "requested"].includes(
                      connection.permissions[metric],
                    ) && s.permissionGranted,
                  ]}
                >
                  {connection.permissions[metric] === "granted"
                    ? "Allowed"
                    : connection.permissions[metric] === "requested"
                      ? "Requested"
                      : connection.permissions[metric] === "denied"
                        ? "Not allowed"
                        : "Not asked"}
                </Text>
              </View>
              <Text style={s.healthValue}>
                {snapshot
                  ? `${Math.round(snapshot.value * 10) / 10} ${snapshot.unit}`
                  : "No data yet"}
              </Text>
              {snapshot && (
                <Text numberOfLines={1} style={s.healthSource}>
                  {snapshot.date} · {snapshot.source}
                  {snapshot.measurementMethod
                    ? ` · ${snapshot.measurementMethod.toUpperCase()}`
                    : ""}
                </Text>
              )}
            </View>
          ))}
        </View>
        <View style={s.healthButtons}>
          <Pressable
            disabled={syncing}
            accessibilityRole="button"
            onPress={() => runSync(!connection.syncEnabled)}
            style={[s.circleButton, s.healthPrimary]}
          >
            {syncing ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <RefreshCw size={15} color="white" />
                <Text style={s.circleButtonText}>
                  {connection.syncEnabled ? "Sync now" : "Connect"}
                </Text>
              </>
            )}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={openHealthSettings} style={s.manageHealthButton}>
            <Text style={s.manageHealthText}>
              {Platform.OS === "ios"
                ? "Open iPhone settings"
                : "Manage Health Connect access"}
            </Text>
          </Pressable>
        </View>
        {connection.lastSyncAt && (
          <Text style={s.lastSync}>
            Last synced {new Date(connection.lastSyncAt).toLocaleString()}
          </Text>
        )}
        <View style={s.healthPrivacy}>
          <ShieldCheck size={16} color={C.green} />
          <Text style={s.healthPrivacyText}>
            Foreground sync only. Background access is not requested in this
            release.
          </Text>
        </View>
      </Card>
    </>
  );
}
