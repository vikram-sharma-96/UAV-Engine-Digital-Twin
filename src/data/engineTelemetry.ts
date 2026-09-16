export interface TelemetryPoint {
  time: string;
  rpm: number;
  temperature: number;
  vibration: number;
  oilPressure: number;
}

export interface ComponentHealth {
  name: string;
  score: number;
  status: 'OPTIMAL' | 'ACCEPTABLE' | 'DEGRADED' | 'CRITICAL';
  description: string;
  tag: string;
}

export interface FaultEvent {
  id: string;
  time: string;
  description: string;
  subsystem: string;
  severity: 'NORMAL' | 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface EngineTelemetryState {
  system: {
    id: string;
    model: string;
    firmware: string;
    streamStatus: 'Connected' | 'Reconnecting' | 'Disconnected';
    updateRate: string;
    dataSource: string;
    mlModelStatus: string;
    aiAgentStatus: string;
    operatingHours: number;
    flightMode: string;
  };
  metrics: {
    healthScore: number;
    healthStatus: 'HEALTHY' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
    rpm: number;
    rpmNominal: string;
    temperature: number;
    temperatureNominal: string;
    oilPressure: number;
    oilPressureNominal: string;
    vibration: number;
    vibrationNominal: string;
    fuelConsumption: number;
    fuelNominal: string;
    exhaustGasTemp: number;
    manifoldAirPressure: number;
  };
  components: ComponentHealth[];
  faults: {
    activeFaultsCount: number;
    currentStatus: string;
    recentEvents: FaultEvent[];
  };
  predictive: {
    nextInspection: string;
    bearingCondition: string;
    coolingSystem: string;
    maintenanceRisk: string;
    remainingUsefulLife: string;
    rulConfidence: string;
  };
  historical: TelemetryPoint[];
}

export const initialEngineData: EngineTelemetryState = {
  system: {
    id: "UAV-PT900-X1",
    model: "Rotax-Type Aero 2-Stroke / 4-Cyl Boxer UAV",
    firmware: "v2.8.4-avionics",
    streamStatus: "Connected",
    updateRate: "1 sec",
    dataSource: "Engine Simulator (CAN-Bus Bus 0)",
    mlModelStatus: "Not connected",
    aiAgentStatus: "Offline",
    operatingHours: 142.8,
    flightMode: "CRUISE_NOMINAL"
  },
  metrics: {
    healthScore: 94,
    healthStatus: "HEALTHY",
    rpm: 5200,
    rpmNominal: "4,800 - 5,500 RPM",
    temperature: 78,
    temperatureNominal: "70 - 85 °C",
    oilPressure: 4.3,
    oilPressureNominal: "3.8 - 5.0 bar",
    vibration: 1.2,
    vibrationNominal: "0.8 - 2.0 mm/s",
    fuelConsumption: 2.7,
    fuelNominal: "2.4 - 3.2 L/h",
    exhaustGasTemp: 642,
    manifoldAirPressure: 1.02
  },
  components: [
    { name: "Cylinder System", score: 96, status: "OPTIMAL", description: "Compression ratio 10.4:1 nominal across dual banks", tag: "CYL-01/02" },
    { name: "Lubrication System", score: 92, status: "OPTIMAL", description: "Sump pressure 4.3 bar, thermal viscosity in index", tag: "LUB-PUMP" },
    { name: "Bearing System", score: 94, status: "OPTIMAL", description: "Main journal harmonics baseline 0.45g vibration", tag: "BRG-MAIN" },
    { name: "Cooling System", score: 95, status: "OPTIMAL", description: "Coolant delta T at 12.4°C across radiator core", tag: "COOL-RAD" },
    { name: "Fuel System", score: 93, status: "OPTIMAL", description: "High-pressure injector timing 1.84ms symmetric", tag: "INJ-BANK" }
  ],
  faults: {
    activeFaultsCount: 0,
    currentStatus: "NO ACTIVE FAULTS",
    recentEvents: [
      { id: "EVT-104", time: "15:10:42", description: "Engine operating normally", subsystem: "CORE", severity: "NORMAL" },
      { id: "EVT-103", time: "15:08:15", description: "Cylinder head temperature within normal range (78°C)", subsystem: "THERMAL", severity: "NORMAL" },
      { id: "EVT-102", time: "15:05:00", description: "Vibration spectrum normal (1.2 mm/s RMS)", subsystem: "ACOUSTIC", severity: "NORMAL" },
      { id: "EVT-101", time: "15:01:22", description: "Oil pump pressure stabilized at 4.3 bar", subsystem: "LUBRICATION", severity: "NORMAL" },
      { id: "EVT-100", time: "14:55:10", description: "Pre-flight telemetry handshake completed", subsystem: "AVIONICS", severity: "INFO" }
    ]
  },
  predictive: {
    nextInspection: "47 operating hours",
    bearingCondition: "Healthy",
    coolingSystem: "Normal",
    maintenanceRisk: "Low",
    remainingUsefulLife: "320 hrs to scheduled overhaul",
    rulConfidence: "98.4% (XGBoost / LSTM ensemble)"
  },
  historical: [
    { time: "15:00", rpm: 5180, temperature: 76, vibration: 1.1, oilPressure: 4.2 },
    { time: "15:01", rpm: 5190, temperature: 76, vibration: 1.2, oilPressure: 4.3 },
    { time: "15:02", rpm: 5210, temperature: 77, vibration: 1.1, oilPressure: 4.3 },
    { time: "15:03", rpm: 5200, temperature: 77, vibration: 1.2, oilPressure: 4.3 },
    { time: "15:04", rpm: 5205, temperature: 78, vibration: 1.2, oilPressure: 4.2 },
    { time: "15:05", rpm: 5215, temperature: 78, vibration: 1.2, oilPressure: 4.3 },
    { time: "15:06", rpm: 5195, temperature: 78, vibration: 1.3, oilPressure: 4.3 },
    { time: "15:07", rpm: 5200, temperature: 77, vibration: 1.2, oilPressure: 4.4 },
    { time: "15:08", rpm: 5210, temperature: 78, vibration: 1.2, oilPressure: 4.3 },
    { time: "15:09", rpm: 5220, temperature: 79, vibration: 1.2, oilPressure: 4.3 },
    { time: "15:10", rpm: 5200, temperature: 78, vibration: 1.2, oilPressure: 4.3 }
  ]
};

export const simulationPresets = {
  normal: {
    name: "Normal Operation",
    healthScore: 94,
    healthStatus: "HEALTHY" as const,
    rpm: 5200,
    temperature: 78,
    oilPressure: 4.3,
    vibration: 1.2,
    fuelConsumption: 2.7,
    statusText: "ENGINE STATUS: HEALTHY",
    faultText: "NO ACTIVE FAULTS",
    activeFaults: 0,
    components: { cylinder: 96, lub: 92, bearing: 94, cooling: 95, fuel: 93 },
    newAlert: { id: "SIM-01", time: "NOW", description: "Nominal operational telemetry restored", subsystem: "CORE", severity: "NORMAL" as const }
  },
  overheating: {
    name: "Simulate Overheating",
    healthScore: 71,
    healthStatus: "WARNING" as const,
    rpm: 5280,
    temperature: 104,
    oilPressure: 3.6,
    vibration: 1.8,
    fuelConsumption: 3.4,
    statusText: "ENGINE STATUS: THERMAL WARNING",
    faultText: "CYLINDER HEAD OVERTEMP EXCEEDED",
    activeFaults: 1,
    components: { cylinder: 81, lub: 74, bearing: 82, cooling: 56, fuel: 91 },
    newAlert: { id: "SIM-02", time: "NOW", description: "High thermal gradient detected in cylinder head 2 (104°C)", subsystem: "COOLING", severity: "WARNING" as const }
  },
  bearing: {
    name: "Simulate Bearing Fault",
    healthScore: 63,
    healthStatus: "CRITICAL" as const,
    rpm: 4920,
    temperature: 89,
    oilPressure: 3.2,
    vibration: 3.9,
    fuelConsumption: 3.1,
    statusText: "ENGINE STATUS: VIBRATION ANOMALY",
    faultText: "JOURNAL BEARING HARMONIC SPIKE",
    activeFaults: 2,
    components: { cylinder: 88, lub: 67, bearing: 48, cooling: 89, fuel: 92 },
    newAlert: { id: "SIM-03", time: "NOW", description: "Bearing vibration 3.9 mm/s exceeds cruise safety threshold", subsystem: "BEARING", severity: "CRITICAL" as const }
  },
  oilPressure: {
    name: "Simulate Low Oil Pressure",
    healthScore: 58,
    healthStatus: "CRITICAL" as const,
    rpm: 4850,
    temperature: 92,
    oilPressure: 1.9,
    vibration: 2.4,
    fuelConsumption: 2.9,
    statusText: "ENGINE STATUS: LOW LUBRICATION PRESSURE",
    faultText: "PRIMARY OIL PRESSURE DROP",
    activeFaults: 2,
    components: { cylinder: 79, lub: 39, bearing: 62, cooling: 80, fuel: 90 },
    newAlert: { id: "SIM-04", time: "NOW", description: "Crankcase oil pressure below 2.0 bar minimum threshold", subsystem: "LUBRICATION", severity: "CRITICAL" as const }
  },
  degradation: {
    name: "Simulate Performance Degradation",
    healthScore: 77,
    healthStatus: "ADVISORY" as const,
    rpm: 4680,
    temperature: 84,
    oilPressure: 3.9,
    vibration: 2.1,
    fuelConsumption: 3.6,
    statusText: "ENGINE STATUS: DEGRADED EFFICIENCY",
    faultText: "COMBUSTION TIMING & FUEL DELTA",
    activeFaults: 1,
    components: { cylinder: 73, lub: 84, bearing: 82, cooling: 85, fuel: 68 },
    newAlert: { id: "SIM-05", time: "NOW", description: "Fuel specific consumption +33% above nominal cruise baseline", subsystem: "FUEL", severity: "WARNING" as const }
  }
};
