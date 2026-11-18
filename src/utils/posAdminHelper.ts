import {
  LocationUnit,
  ManagedUserAccount,
  RoleProfile,
  RoomUnit,
} from '../types/simas';

export interface PosAdminInfo {
  name: string;
  nip: string;
  jabatan: string;
}

/**
 * Default Pos Admin directory aligned with authClient & server accounts
 * so room signatures remain accurate even before /api/rbac/config finishes loading
 * or in public read-only QR verification view.
 */
const DEFAULT_POS_ADMIN_BY_LOCATION: Record<string, PosAdminInfo> = {
  'LOC-MAKO': {
    name: 'Mochamad Irfan',
    nip: '19900611 201801 1 008',
    jabatan: 'Operator Aset Mako & Pusdalops (Admin Mako)',
  },
  'LOC-POS-01': {
    name: 'Satuman',
    nip: '19780412 200901 1 001',
    jabatan: 'Penanggung Jawab Pos Damkar Kota',
  },
  'LOC-POS-02': {
    name: 'Ngadi, SH',
    nip: '19790514 201001 1 002',
    jabatan: 'Penanggung Jawab Pos Damkar Buduran',
  },
  'LOC-POS-03': {
    name: 'Sutoyo',
    nip: '19810310 201101 1 003',
    jabatan: 'Penanggung Jawab Pos Damkar Waru',
  },
  'LOC-POS-04': {
    name: 'Widy Agus Setyawan',
    nip: '19830718 201201 1 004',
    jabatan: 'Penanggung Jawab Pos Damkar Krian',
  },
  'LOC-POS-05': {
    name: 'Edi Mulyadi',
    nip: '19840922 201301 1 005',
    jabatan: 'Penanggung Jawab Pos Damkar Porong',
  },
  'LOC-POS-06': {
    name: 'Dita Mandariga',
    nip: '19861105 201401 1 006',
    jabatan: 'Penanggung Jawab Pos Damkar Candi',
  },
  'LOC-POS-07': {
    name: 'Nur Achmad Zamanudin',
    nip: '19880217 201501 1 007',
    jabatan: 'Penanggung Jawab Pos Damkar Sukodono',
  },
};

export function formatNip18(rawNip?: string): string {
  const trimmed = (rawNip ?? '').trim();
  if (!trimmed) return '-';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 18) {
    return `${digits.slice(0, 8)} ${digits.slice(8, 14)} ${digits.slice(14, 15)} ${digits.slice(15, 18)}`;
  }
  return trimmed;
}

export function resolvePosAdminForLocation(
  locationId: string,
  users: ManagedUserAccount[],
  locations: LocationUnit[],
  currentProfile?: RoleProfile | null
): PosAdminInfo | null {
  if (!locationId) return null;

  if (currentProfile?.assignedLocationId === locationId && currentProfile.officerName) {
    return {
      name: currentProfile.officerName,
      nip: formatNip18(currentProfile.nip),
      jabatan: currentProfile.jabatan || 'Penanggung Jawab Pos',
    };
  }

  const matchedUser =
    users.find(
      (u) =>
        u.isActive &&
        u.assignedLocationId === locationId &&
        u.role === 'PETUGAS_LAPANGAN'
    ) ??
    users.find((u) => u.isActive && u.assignedLocationId === locationId);

  if (matchedUser) {
    return {
      name: matchedUser.officerName,
      nip: formatNip18(matchedUser.nip),
      jabatan: matchedUser.jabatan || `Penanggung Jawab ${matchedUser.unitName}`,
    };
  }

  if (DEFAULT_POS_ADMIN_BY_LOCATION[locationId]) {
    return DEFAULT_POS_ADMIN_BY_LOCATION[locationId];
  }

  const loc = locations.find((l) => l.id === locationId);
  if (loc) {
    return {
      name: loc.coordinator,
      nip: '-',
      jabatan: `Penanggung Jawab ${loc.name}`,
    };
  }

  return null;
}

export function syncRoomsWithPosAdmins(
  rooms: RoomUnit[],
  users: ManagedUserAccount[],
  locations: LocationUnit[],
  currentProfile?: RoleProfile | null
): RoomUnit[] {
  return rooms.map((room) => {
    const admin = resolvePosAdminForLocation(
      room.locationId,
      users,
      locations,
      currentProfile
    );
    if (!admin) return room;
    return {
      ...room,
      penanggungJawab: admin.name,
      nipPenanggungJawab: admin.nip !== '-' ? admin.nip : room.nipPenanggungJawab,
      jabatanPenanggungJawab: admin.jabatan,
    };
  });
}
