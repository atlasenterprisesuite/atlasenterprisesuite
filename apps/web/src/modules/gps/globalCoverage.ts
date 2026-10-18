export type CoverageSectorStatus = 'pending' | 'in-progress' | 'complete' | 'blocked';

export type CoverageBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type CoverageSector = {
  id: string;
  row: number;
  column: number;
  bounds: CoverageBounds;
  center: { lat: number; lon: number };
  status: CoverageSectorStatus;
  completedStreetSegments: number;
  totalStreetSegments: number | null;
};

export type CoverageGrid = {
  id: string;
  bounds: CoverageBounds;
  targetSectorKm: number;
  rows: number;
  columns: number;
  sectors: CoverageSector[];
};

const KM_PER_LAT_DEGREE = 111.32;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeCoverageBounds(bounds: CoverageBounds): CoverageBounds {
  const south = clamp(Math.min(bounds.south, bounds.north), -85, 85);
  const north = clamp(Math.max(bounds.south, bounds.north), -85, 85);
  const west = clamp(Math.min(bounds.west, bounds.east), -180, 180);
  const east = clamp(Math.max(bounds.west, bounds.east), -180, 180);
  return { south, west, north, east };
}

function stableNumber(value: number) {
  return Number(value.toFixed(6));
}

export function buildCoverageGrid(
  id: string,
  rawBounds: CoverageBounds,
  targetSectorKm = 2,
  maxSectors = 10_000
): CoverageGrid {
  const bounds = normalizeCoverageBounds(rawBounds);
  const safeSectorKm = clamp(Number.isFinite(targetSectorKm) ? targetSectorKm : 2, 0.25, 100);
  const safeMax = Math.max(1, Math.min(100_000, Math.floor(maxSectors)));

  const latSpan = Math.max(0, bounds.north - bounds.south);
  const lonSpan = Math.max(0, bounds.east - bounds.west);
  const midLatRad = ((bounds.south + bounds.north) / 2) * Math.PI / 180;
  const kmPerLonDegree = Math.max(1, KM_PER_LAT_DEGREE * Math.cos(midLatRad));

  let rows = Math.max(1, Math.ceil((latSpan * KM_PER_LAT_DEGREE) / safeSectorKm));
  let columns = Math.max(1, Math.ceil((lonSpan * kmPerLonDegree) / safeSectorKm));

  if (rows * columns > safeMax) {
    const scale = Math.sqrt((rows * columns) / safeMax);
    rows = Math.max(1, Math.floor(rows / scale));
    columns = Math.max(1, Math.floor(columns / scale));
    while (rows * columns > safeMax) {
      if (rows >= columns && rows > 1) rows -= 1;
      else if (columns > 1) columns -= 1;
      else break;
    }
  }

  const latStep = latSpan / rows;
  const lonStep = lonSpan / columns;
  const sectors: CoverageSector[] = [];

  for (let row = 0; row < rows; row += 1) {
    const south = row === 0 ? bounds.south : bounds.south + latStep * row;
    const north = row === rows - 1 ? bounds.north : bounds.south + latStep * (row + 1);

    for (let column = 0; column < columns; column += 1) {
      const west = column === 0 ? bounds.west : bounds.west + lonStep * column;
      const east = column === columns - 1 ? bounds.east : bounds.west + lonStep * (column + 1);
      const sectorBounds = {
        south: stableNumber(south),
        west: stableNumber(west),
        north: stableNumber(north),
        east: stableNumber(east)
      };

      sectors.push({
        id: id + ':r' + row + ':c' + column,
        row,
        column,
        bounds: sectorBounds,
        center: {
          lat: stableNumber((sectorBounds.south + sectorBounds.north) / 2),
          lon: stableNumber((sectorBounds.west + sectorBounds.east) / 2)
        },
        status: 'pending',
        completedStreetSegments: 0,
        totalStreetSegments: null
      });
    }
  }

  return {
    id,
    bounds,
    targetSectorKm: safeSectorKm,
    rows,
    columns,
    sectors
  };
}

export function updateCoverageSector(
  grid: CoverageGrid,
  sectorId: string,
  patch: Partial<Pick<CoverageSector,
    'status' | 'completedStreetSegments' | 'totalStreetSegments'
  >>
): CoverageGrid {
  return {
    ...grid,
    sectors: grid.sectors.map((sector) => {
      if (sector.id !== sectorId) return sector;
      const completedStreetSegments = Math.max(
        0,
        Math.floor(patch.completedStreetSegments ?? sector.completedStreetSegments)
      );
      const totalStreetSegments = patch.totalStreetSegments === undefined
        ? sector.totalStreetSegments
        : patch.totalStreetSegments === null
          ? null
          : Math.max(0, Math.floor(patch.totalStreetSegments));

      return {
        ...sector,
        ...patch,
        completedStreetSegments,
        totalStreetSegments
      };
    })
  };
}

export function nextCoverageSector(grid: CoverageGrid): CoverageSector | null {
  return grid.sectors.find((sector) => sector.status === 'in-progress') ||
    grid.sectors.find((sector) => sector.status === 'pending') ||
    null;
}

export function summarizeCoverageGrid(grid: CoverageGrid) {
  const counts = { pending: 0, inProgress: 0, complete: 0, blocked: 0 };
  for (const sector of grid.sectors) {
    if (sector.status === 'pending') counts.pending += 1;
    else if (sector.status === 'in-progress') counts.inProgress += 1;
    else if (sector.status === 'complete') counts.complete += 1;
    else counts.blocked += 1;
  }

  const resolved = counts.complete + counts.blocked;
  return {
    ...counts,
    total: grid.sectors.length,
    resolved,
    completionPct: grid.sectors.length
      ? Math.round((resolved / grid.sectors.length) * 10_000) / 100
      : 0,
    complete: grid.sectors.length > 0 && resolved === grid.sectors.length
  };
}
