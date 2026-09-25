export interface Observation {
  id: string;
  location: string;
  department: string;
  photo: string | null; // base64
  status: string;
}

export interface ShiftInfo {
  inCharge: string;
  name: string;
}

export interface SecurityReport {
  metadata: {
    valueOfDay: string;
    date: string;
    time: string;
    reportBy: string;
    shiftInCharge: string;
    firstResponderRoster: string;
    morningShift: ShiftInfo;
    afternoonShift: ShiftInfo;
    nightShift: ShiftInfo;
  };
  tasks: {
    guestLocks: string;
    electricSafe: string;
    dndRooms: string;
    mechanicalRoom: string;
    overnightVehicles: {
      guest2W: string;
      guest4W: string;
      staff2W: string;
      staff4W: string;
    };
    staffDeclarations: string;
    lostFound: string;
    incidentAccident: string;
    specialEvents: string;
    trainingDrills: string;
    inspectionsAlcohol: string;
    friskingRecovery: string;
    singleLady: string;
  };
  openDoors: { room: string; status: string; remark: string }[];
  gadgetStatus: { gadget: string; remark: string }[];
  keyDiscrepancies: { keyNo: string; doorName: string; department: string; issuer: string; date: string; time: string; contact: string }[];
  pickUpDown: { time: string; maleStaff: string; femaleStaff: string; chauffeur: string; vehicle: string; remarks: string }[];
  garbage: {
    time: string;
    vehicleNo: string;
    dryWeight: string;
    dryBags: string;
    cartoonWeight: string;
    wetWeight: string;
    wetBags: string;
    foundItems: string;
    foundPhoto: string | null;
    foundRemarks: string;
    checkedBy: string;
  };
  alarms: {
    fireAlarms: string;
    gasAlarms: string;
    panicBuzzer: string;
    facp: {
      alarm: string;
      trouble: string;
      supervisory: string;
      monitors: string;
    };
    alarmDetails: string;
  };
  observations: Observation[];
}
