/** Graham forward-growth assumption policy for the operating-company pilot.
 * These are scenario inputs, not measured EPS growth or analyst consensus.
 * Sector labels come from the imported asset catalogue.
 */
export function grahamSectorGrowth(sector:string):{rate:number;label:string;basis:"SECTOR_ASSUMPTION"}{
 const category=sector.trim().toLowerCase();
 const technology=/\b(technology|information technology|software|semiconductors?|computer hardware|tech)\b/.test(category);
 return {rate:technology?7:5,label:technology?"Technology":"Operating / industrial baseline",basis:"SECTOR_ASSUMPTION"};
}
