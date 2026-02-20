import { useState, useEffect, useCallback } from 'react';

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface GeoLocationState {
  coordinates: Coordinates | null;
  error: string | null;
  loading: boolean;
  hasPermission: boolean | null;
}

interface UseGeoLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watchPosition?: boolean;
}

export function useGeoLocation(options: UseGeoLocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    watchPosition = false
  } = options;

  const [state, setState] = useState<GeoLocationState>({
    coordinates: null,
    error: null,
    loading: false,
    hasPermission: null
  });

  const checkPermission = useCallback(async () => {
    if (!navigator.permissions) {
      return null;
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state === 'granted' ? true : result.state === 'denied' ? false : null;
    } catch {
      return null;
    }
  }, []);

  const onSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      coordinates: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      },
      error: null,
      loading: false,
      hasPermission: true
    });
  }, []);

  const onError = useCallback((error: GeolocationPositionError) => {
    let errorMessage: string;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable. Please try again.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out. Please try again.';
        break;
      default:
        errorMessage = 'An unknown error occurred while getting location.';
    }

    setState(prev => ({
      ...prev,
      error: errorMessage,
      loading: false,
      hasPermission: error.code === error.PERMISSION_DENIED ? false : null
    }));
  }, []);

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser.',
        loading: false
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy,
      timeout,
      maximumAge
    });
  }, [enableHighAccuracy, timeout, maximumAge, onSuccess, onError]);

  useEffect(() => {
    checkPermission().then(hasPermission => {
      setState(prev => ({ ...prev, hasPermission }));
    });
  }, [checkPermission]);

  useEffect(() => {
    if (watchPosition && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy,
        timeout,
        maximumAge
      });

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [watchPosition, enableHighAccuracy, timeout, maximumAge, onSuccess, onError]);

  const requestPermission = useCallback(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  return {
    ...state,
    getCurrentPosition,
    requestPermission
  };
}

export function haversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * (Math.PI / 180);

  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);
  const deltaLat = toRad(coord2.latitude - coord1.latitude);
  const deltaLng = toRad(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
