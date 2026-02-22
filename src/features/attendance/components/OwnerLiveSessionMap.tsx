import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AttendanceRecord, SessionSummary } from "../types";
import { formatDateTime } from "../utils/rotatingSession";

interface OwnerLiveSessionMapProps {
  sessions: SessionSummary[];
  records: AttendanceRecord[];
}

interface SessionUiState {
  status: SessionSummary["status"];
  endsAt: string;
}

interface SessionAttendancePoint {
  record: AttendanceRecord;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  isInsideRadius: boolean | null;
}

const FALLBACK_RADIUS_METERS = 120;
const MAX_MAP_STUDENT_MARKERS = 80;

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const toRadians = (value: number): number => {
  return (value * Math.PI) / 180;
};

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const earthRadiusMeters = 6_371_000;
  const latDelta = toRadians(lat2 - lat1);
  const lonDelta = toRadians(lon2 - lon1);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(lonDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

const calculateZoomByRadius = (latitude: number, radiusMeters: number): number => {
  const safeRadius = Math.max(radiusMeters, 20);
  const viewportWidthPixels = 1200;
  const paddingFactor = 2.8;
  const metersPerPixel = (safeRadius * paddingFactor) / (viewportWidthPixels / 2);
  const latCos = Math.cos(toRadians(latitude));
  const zoom = Math.log2((156543.03392 * latCos) / metersPerPixel);
  return clamp(zoom, 3, 18);
};

const buildCirclePolygon = (
  centerLatitude: number,
  centerLongitude: number,
  radiusMeters: number,
  points: number = 64,
): [number, number][] => {
  const earthRadiusMeters = 6_378_137;
  const angularDistance = radiusMeters / earthRadiusMeters;
  const centerLatRad = toRadians(centerLatitude);
  const centerLonRad = toRadians(centerLongitude);
  const coordinates: [number, number][] = [];

  for (let index = 0; index <= points; index += 1) {
    const bearing = (2 * Math.PI * index) / points;
    const sinLat =
      Math.sin(centerLatRad) * Math.cos(angularDistance) +
      Math.cos(centerLatRad) * Math.sin(angularDistance) * Math.cos(bearing);
    const latRad = Math.asin(sinLat);
    const lonRad =
      centerLonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatRad),
        Math.cos(angularDistance) - Math.sin(centerLatRad) * Math.sin(latRad),
      );

    coordinates.push([(lonRad * 180) / Math.PI, (latRad * 180) / Math.PI]);
  }

  return coordinates;
};

const getDeviceInfo = (record: AttendanceRecord): string => {
  const deviceHash = record.deviceHash ? `Device: ${record.deviceHash.slice(0, 12)}` : "Device: N/A";
  const ipAddress = record.ipAddress ? `IP: ${record.ipAddress}` : "IP: N/A";
  return `${deviceHash} | ${ipAddress}`;
};

const buildMapboxStaticUrl = (
  session: SessionSummary,
  points: SessionAttendancePoint[],
): string | null => {
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
  const centerLatitude = session.latitude ?? null;
  const centerLongitude = session.longitude ?? null;
  const radiusMeters = Math.max(session.geofenceRadiusMeters ?? FALLBACK_RADIUS_METERS, 1);

  if (!mapboxToken || centerLatitude === null || centerLongitude === null) {
    return null;
  }

  const markerPoints = points
    .filter((point) => point.latitude !== null && point.longitude !== null && point.isInsideRadius !== null)
    .slice(0, MAX_MAP_STUDENT_MARKERS);

  const circleFeature = {
    type: "Feature",
    properties: {
      stroke: "#2563EB",
      "stroke-width": 2,
      "stroke-opacity": 0.8,
      fill: "#2563EB",
      "fill-opacity": 0.12,
    },
    geometry: {
      type: "Polygon",
      coordinates: [buildCirclePolygon(centerLatitude, centerLongitude, radiusMeters)],
    },
  };

  const centerFeature = {
    type: "Feature",
    properties: {
      "marker-size": "large",
      "marker-color": "#1D4ED8",
      "marker-symbol": "star",
    },
    geometry: {
      type: "Point",
      coordinates: [centerLongitude, centerLatitude],
    },
  };

  const studentFeatures = markerPoints.map((point) => ({
    type: "Feature",
    properties: {
      "marker-size": "small",
      "marker-color": point.isInsideRadius ? "#16A34A" : "#DC2626",
    },
    geometry: {
      type: "Point",
      coordinates: [point.longitude, point.latitude],
    },
  }));

  const featureCollection = {
    type: "FeatureCollection",
    features: [circleFeature, centerFeature, ...studentFeatures],
  };

  const overlay = encodeURIComponent(JSON.stringify(featureCollection));
  const zoom = calculateZoomByRadius(centerLatitude, radiusMeters).toFixed(2);

  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/geojson(${overlay})/${centerLongitude},${centerLatitude},${zoom}/1200x680?access_token=${mapboxToken}`;
};

export const OwnerLiveSessionMap = ({ sessions, records }: OwnerLiveSessionMapProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionUiState, setSessionUiState] = useState<Record<string, SessionUiState>>({});

  const liveSessions = useMemo(() => {
    return sessions
      .map((session) => {
        const override = sessionUiState[session.id];
        if (!override) {
          return session;
        }
        return {
          ...session,
          status: override.status,
          endsAt: override.endsAt,
        };
      })
      .filter((session) => session.status === "active");
  }, [sessions, sessionUiState]);

  useEffect(() => {
    if (liveSessions.length === 0) {
      setSelectedSessionId("");
      return;
    }

    const exists = liveSessions.some((session) => session.id === selectedSessionId);
    if (!exists) {
      setSelectedSessionId(liveSessions[0].id);
    }
  }, [liveSessions, selectedSessionId]);

  const selectedSession = useMemo(() => {
    return liveSessions.find((session) => session.id === selectedSessionId) ?? null;
  }, [liveSessions, selectedSessionId]);

  const sessionAttendancePoints = useMemo<SessionAttendancePoint[]>(() => {
    if (!selectedSession) {
      return [];
    }

    const centerLatitude = selectedSession.latitude ?? null;
    const centerLongitude = selectedSession.longitude ?? null;
    const radiusMeters = Math.max(selectedSession.geofenceRadiusMeters ?? FALLBACK_RADIUS_METERS, 1);

    return records
      .filter((record) => record.sessionId === selectedSession.id)
      .map((record) => {
        const latitude = typeof record.latitude === "number" ? record.latitude : null;
        const longitude = typeof record.longitude === "number" ? record.longitude : null;

        if (centerLatitude === null || centerLongitude === null || latitude === null || longitude === null) {
          return {
            record,
            latitude,
            longitude,
            distanceMeters: null,
            isInsideRadius: null,
          };
        }

        const distanceMeters = haversineMeters(centerLatitude, centerLongitude, latitude, longitude);
        return {
          record,
          latitude,
          longitude,
          distanceMeters,
          isInsideRadius: distanceMeters <= radiusMeters,
        };
      })
      .sort((left, right) => {
        const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
        const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;
        return leftDistance - rightDistance;
      });
  }, [records, selectedSession]);

  const outsideRadiusCount = useMemo(() => {
    return sessionAttendancePoints.filter((point) => point.isInsideRadius === false).length;
  }, [sessionAttendancePoints]);

  const staticMapUrl = useMemo(() => {
    if (!selectedSession) {
      return null;
    }

    return buildMapboxStaticUrl(selectedSession, sessionAttendancePoints);
  }, [selectedSession, sessionAttendancePoints]);

  const handleForceCloseSession = () => {
    if (!selectedSession) {
      return;
    }

    setSessionUiState((current) => ({
      ...current,
      [selectedSession.id]: {
        status: "ended",
        endsAt: new Date().toISOString(),
      },
    }));
  };

  const handleExtendSessionByFiveMinutes = () => {
    if (!selectedSession) {
      return;
    }

    const currentEndTime = new Date(selectedSession.endsAt);
    if (Number.isNaN(currentEndTime.getTime())) {
      return;
    }

    const updatedEndTime = new Date(currentEndTime.getTime() + 5 * 60 * 1000).toISOString();

    setSessionUiState((current) => ({
      ...current,
      [selectedSession.id]: {
        status: selectedSession.status,
        endsAt: updatedEndTime,
      },
    }));
  };

  return (
    <Card className="overflow-hidden border-primary/25 bg-card/85">
      <CardHeader className="space-y-2 pb-3">
        <CardTitle className="text-lg">Owner Live Session Map</CardTitle>
        <CardDescription>Mapbox live geofence view with student positions for active sessions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {liveSessions.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
            No active sessions are available right now.
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-3 rounded-lg border border-border/70 bg-background/60 p-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Active Session
                  </p>
                  <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select active session" />
                    </SelectTrigger>
                    <SelectContent>
                      {liveSessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.subjectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSession ? (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Center:</span>{" "}
                      {selectedSession.latitude?.toFixed(6) ?? "N/A"}, {selectedSession.longitude?.toFixed(6) ?? "N/A"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Radius:</span>{" "}
                      {selectedSession.geofenceRadiusMeters ?? FALLBACK_RADIUS_METERS}m
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Ends At:</span> {formatDateTime(selectedSession.endsAt)}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button type="button" variant="destructive" size="sm" onClick={handleForceCloseSession}>
                        إنهاء الجلسة
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleExtendSessionByFiveMinutes}>
                        تمديد 5 دقائق
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                {staticMapUrl ? (
                  <img
                    src={staticMapUrl}
                    alt="Session center and student attendance positions"
                    className="h-[360px] w-full rounded-lg border border-border/70 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 text-sm text-muted-foreground">
                    Map unavailable. Set `VITE_MAPBOX_ACCESS_TOKEN` and ensure session coordinates exist.
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Center marker: blue | Students: green (inside) / red (outside geofence)
                </p>
              </div>
            </div>

            {selectedSession ? (
              <div className="overflow-hidden rounded-lg border border-border/70">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/15 px-3 py-2">
                  <p className="text-sm font-medium">Live Attendance Details</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{sessionAttendancePoints.length} Students</Badge>
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                      {sessionAttendancePoints.length - outsideRadiusCount} Inside
                    </Badge>
                    <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
                      {outsideRadiusCount} Outside
                    </Badge>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Distance</th>
                        <th className="px-3 py-2 font-medium">Timestamp</th>
                        <th className="px-3 py-2 font-medium">Device Info</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionAttendancePoints.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-5 text-center text-muted-foreground">
                            No attendance records found for this session.
                          </td>
                        </tr>
                      ) : (
                        sessionAttendancePoints.map((point) => (
                          <tr key={point.record.id} className="border-b border-border/50">
                            <td className="px-3 py-2">
                              {point.record.studentName || point.record.studentId}
                            </td>
                            <td className="px-3 py-2">
                              {point.distanceMeters !== null ? `${point.distanceMeters.toFixed(1)} m` : "N/A"}
                            </td>
                            <td className="px-3 py-2">{formatDateTime(point.record.submittedAt)}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{getDeviceInfo(point.record)}</td>
                            <td className="px-3 py-2">
                              {point.isInsideRadius === null ? (
                                <Badge variant="outline">Unknown</Badge>
                              ) : point.isInsideRadius ? (
                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Inside</Badge>
                              ) : (
                                <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
                                  Outside
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

