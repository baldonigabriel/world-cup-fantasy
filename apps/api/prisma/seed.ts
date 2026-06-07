import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COUNTRIES = [
  { code: 'BRA', name: 'Brasil', flagUrl: 'https://flagcdn.com/br.svg' },
  { code: 'ARG', name: 'Argentina', flagUrl: 'https://flagcdn.com/ar.svg' },
  { code: 'FRA', name: 'França', flagUrl: 'https://flagcdn.com/fr.svg' },
  { code: 'ENG', name: 'Inglaterra', flagUrl: 'https://flagcdn.com/gb-eng.svg' },
  { code: 'GER', name: 'Alemanha', flagUrl: 'https://flagcdn.com/de.svg' },
  { code: 'ESP', name: 'Espanha', flagUrl: 'https://flagcdn.com/es.svg' },
  { code: 'ITA', name: 'Itália', flagUrl: 'https://flagcdn.com/it.svg' },
  { code: 'POR', name: 'Portugal', flagUrl: 'https://flagcdn.com/pt.svg' },
  { code: 'NED', name: 'Holanda', flagUrl: 'https://flagcdn.com/nl.svg' },
  { code: 'BEL', name: 'Bélgica', flagUrl: 'https://flagcdn.com/be.svg' },
  { code: 'CRO', name: 'Croácia', flagUrl: 'https://flagcdn.com/hr.svg' },
  { code: 'URU', name: 'Uruguai', flagUrl: 'https://flagcdn.com/uy.svg' },
  { code: 'MEX', name: 'México', flagUrl: 'https://flagcdn.com/mx.svg' },
  { code: 'USA', name: 'Estados Unidos', flagUrl: 'https://flagcdn.com/us.svg' },
  { code: 'JPN', name: 'Japão', flagUrl: 'https://flagcdn.com/jp.svg' },
  { code: 'SEN', name: 'Senegal', flagUrl: 'https://flagcdn.com/sn.svg' },
  { code: 'MOR', name: 'Marrocos', flagUrl: 'https://flagcdn.com/ma.svg' },
  { code: 'COL', name: 'Colômbia', flagUrl: 'https://flagcdn.com/co.svg' },
  { code: 'SUI', name: 'Suíça', flagUrl: 'https://flagcdn.com/ch.svg' },
  { code: 'POL', name: 'Polônia', flagUrl: 'https://flagcdn.com/pl.svg' },
];

const PLAYERS_BY_COUNTRY: Record<string, { name: string; pos: 'GOL' | 'DEF' | 'MEI' | 'ATA' }[]> = {
  BRA: [
    { name: 'Alisson', pos: 'GOL' },
    { name: 'Ederson', pos: 'GOL' },
    { name: 'Marquinhos', pos: 'DEF' },
    { name: 'Militão', pos: 'DEF' },
    { name: 'Casemiro', pos: 'MEI' },
    { name: 'Bruno Guimarães', pos: 'MEI' },
    { name: 'Vinicius Jr', pos: 'ATA' },
    { name: 'Rodrygo', pos: 'ATA' },
  ],
  ARG: [
    { name: 'Dibu Martínez', pos: 'GOL' },
    { name: 'Rulli', pos: 'GOL' },
    { name: 'Romero', pos: 'DEF' },
    { name: 'Tagliafico', pos: 'DEF' },
    { name: 'De Paul', pos: 'MEI' },
    { name: 'Mac Allister', pos: 'MEI' },
    { name: 'Messi', pos: 'ATA' },
    { name: 'Lautaro', pos: 'ATA' },
  ],
  FRA: [
    { name: 'Maignan', pos: 'GOL' },
    { name: 'Lloris', pos: 'GOL' },
    { name: 'Upamecano', pos: 'DEF' },
    { name: 'Koundé', pos: 'DEF' },
    { name: 'Griezmann', pos: 'MEI' },
    { name: 'Tchouaméni', pos: 'MEI' },
    { name: 'Mbappé', pos: 'ATA' },
    { name: 'Dembélé', pos: 'ATA' },
  ],
  ENG: [
    { name: 'Pickford', pos: 'GOL' },
    { name: 'Ramsdale', pos: 'GOL' },
    { name: 'Stones', pos: 'DEF' },
    { name: 'Trippier', pos: 'DEF' },
    { name: 'Bellingham', pos: 'MEI' },
    { name: 'Rice', pos: 'MEI' },
    { name: 'Kane', pos: 'ATA' },
    { name: 'Saka', pos: 'ATA' },
  ],
  GER: [
    { name: 'Neuer', pos: 'GOL' },
    { name: 'ter Stegen', pos: 'GOL' },
    { name: 'Rüdiger', pos: 'DEF' },
    { name: 'Schlotterbeck', pos: 'DEF' },
    { name: 'Kroos', pos: 'MEI' },
    { name: 'Kimmich', pos: 'MEI' },
    { name: 'Havertz', pos: 'ATA' },
    { name: 'Gnabry', pos: 'ATA' },
  ],
  ESP: [
    { name: 'Unai Simón', pos: 'GOL' },
    { name: 'Raya', pos: 'GOL' },
    { name: 'Laporte', pos: 'DEF' },
    { name: 'Carvajal', pos: 'DEF' },
    { name: 'Pedri', pos: 'MEI' },
    { name: 'Gavi', pos: 'MEI' },
    { name: 'Morata', pos: 'ATA' },
    { name: 'Yamal', pos: 'ATA' },
  ],
  ITA: [
    { name: 'Donnarumma', pos: 'GOL' },
    { name: 'Vicario', pos: 'GOL' },
    { name: 'Bastoni', pos: 'DEF' },
    { name: 'Di Lorenzo', pos: 'DEF' },
    { name: 'Barella', pos: 'MEI' },
    { name: 'Jorginho', pos: 'MEI' },
    { name: 'Immobile', pos: 'ATA' },
    { name: 'Retegui', pos: 'ATA' },
  ],
  POR: [
    { name: 'Rui Patrício', pos: 'GOL' },
    { name: 'Costa', pos: 'GOL' },
    { name: 'Pepe', pos: 'DEF' },
    { name: 'Cancelo', pos: 'DEF' },
    { name: 'Bruno Fernandes', pos: 'MEI' },
    { name: 'Vitinha', pos: 'MEI' },
    { name: 'Ronaldo', pos: 'ATA' },
    { name: 'Félix', pos: 'ATA' },
  ],
  NED: [
    { name: 'Flekken', pos: 'GOL' },
    { name: 'Bijlow', pos: 'GOL' },
    { name: 'Van Dijk', pos: 'DEF' },
    { name: 'Dumfries', pos: 'DEF' },
    { name: 'De Jong', pos: 'MEI' },
    { name: 'Schouten', pos: 'MEI' },
    { name: 'Gakpo', pos: 'ATA' },
    { name: 'Depay', pos: 'ATA' },
  ],
  BEL: [
    { name: 'Casteels', pos: 'GOL' },
    { name: 'Mignolet', pos: 'GOL' },
    { name: 'Vertonghen', pos: 'DEF' },
    { name: 'Castagne', pos: 'DEF' },
    { name: 'De Bruyne', pos: 'MEI' },
    { name: 'Tielemans', pos: 'MEI' },
    { name: 'Lukaku', pos: 'ATA' },
    { name: 'Doku', pos: 'ATA' },
  ],
  CRO: [
    { name: 'Livaković', pos: 'GOL' },
    { name: 'Grbić', pos: 'GOL' },
    { name: 'Gvardiol', pos: 'DEF' },
    { name: 'Ćaleta-Car', pos: 'DEF' },
    { name: 'Modrić', pos: 'MEI' },
    { name: 'Kovačić', pos: 'MEI' },
    { name: 'Kramarić', pos: 'ATA' },
    { name: 'Petković', pos: 'ATA' },
  ],
  URU: [
    { name: 'Rochet', pos: 'GOL' },
    { name: 'Muslera', pos: 'GOL' },
    { name: 'Godín', pos: 'DEF' },
    { name: 'Olivera', pos: 'DEF' },
    { name: 'Valverde', pos: 'MEI' },
    { name: 'Bentancur', pos: 'MEI' },
    { name: 'Suárez', pos: 'ATA' },
    { name: 'Núñez', pos: 'ATA' },
  ],
  MEX: [
    { name: 'Ochoa', pos: 'GOL' },
    { name: 'Talavera', pos: 'GOL' },
    { name: 'Moreno', pos: 'DEF' },
    { name: 'Sánchez', pos: 'DEF' },
    { name: 'Herrera', pos: 'MEI' },
    { name: 'Guardado', pos: 'MEI' },
    { name: 'Jiménez', pos: 'ATA' },
    { name: 'Antuna', pos: 'ATA' },
  ],
  USA: [
    { name: 'Turner', pos: 'GOL' },
    { name: 'Horvath', pos: 'GOL' },
    { name: 'Zimmerman', pos: 'DEF' },
    { name: 'Dest', pos: 'DEF' },
    { name: 'McKennie', pos: 'MEI' },
    { name: 'Adams', pos: 'MEI' },
    { name: 'Pulisic', pos: 'ATA' },
    { name: 'Weah', pos: 'ATA' },
  ],
  JPN: [
    { name: 'Gonda', pos: 'GOL' },
    { name: 'Osako', pos: 'GOL' },
    { name: 'Yoshida', pos: 'DEF' },
    { name: 'Itakura', pos: 'DEF' },
    { name: 'Endo', pos: 'MEI' },
    { name: 'Tanaka', pos: 'MEI' },
    { name: 'Minamino', pos: 'ATA' },
    { name: 'Maeda', pos: 'ATA' },
  ],
  SEN: [
    { name: 'Mendy', pos: 'GOL' },
    { name: 'Gomis', pos: 'GOL' },
    { name: 'Koulibaly', pos: 'DEF' },
    { name: 'Sabaly', pos: 'DEF' },
    { name: 'Gueye', pos: 'MEI' },
    { name: 'Kouyaté', pos: 'MEI' },
    { name: 'Mané', pos: 'ATA' },
    { name: 'Dia', pos: 'ATA' },
  ],
  MOR: [
    { name: 'Bono', pos: 'GOL' },
    { name: 'Munir', pos: 'GOL' },
    { name: 'Aguerd', pos: 'DEF' },
    { name: 'Hakimi', pos: 'DEF' },
    { name: 'Amrabat', pos: 'MEI' },
    { name: 'Ounahi', pos: 'MEI' },
    { name: 'En-Nesyri', pos: 'ATA' },
    { name: 'Ziyech', pos: 'ATA' },
  ],
  COL: [
    { name: 'Vargas', pos: 'GOL' },
    { name: 'Ospina', pos: 'GOL' },
    { name: 'Dávinson', pos: 'DEF' },
    { name: 'Mojica', pos: 'DEF' },
    { name: 'Barrios', pos: 'MEI' },
    { name: 'James', pos: 'MEI' },
    { name: 'Díaz', pos: 'ATA' },
    { name: 'Córdoba', pos: 'ATA' },
  ],
  SUI: [
    { name: 'Sommer', pos: 'GOL' },
    { name: 'Kobel', pos: 'GOL' },
    { name: 'Akanji', pos: 'DEF' },
    { name: 'Rodriguez', pos: 'DEF' },
    { name: 'Xhaka', pos: 'MEI' },
    { name: 'Freuler', pos: 'MEI' },
    { name: 'Shaqiri', pos: 'ATA' },
    { name: 'Embolo', pos: 'ATA' },
  ],
  POL: [
    { name: 'Szczęsny', pos: 'GOL' },
    { name: 'Grabara', pos: 'GOL' },
    { name: 'Glik', pos: 'DEF' },
    { name: 'Bereszyński', pos: 'DEF' },
    { name: 'Krychowiak', pos: 'MEI' },
    { name: 'Zieliński', pos: 'MEI' },
    { name: 'Lewandowski', pos: 'ATA' },
    { name: 'Świderski', pos: 'ATA' },
  ],
};

async function main() {
  console.log('Seeding countries and players...\n');

  for (const country of COUNTRIES) {
    const created = await prisma.country.upsert({
      where: { code: country.code },
      update: { name: country.name, flagUrl: country.flagUrl },
      create: country,
    });

    const players = PLAYERS_BY_COUNTRY[country.code] ?? [];
    let added = 0;

    for (const p of players) {
      const exists = await prisma.player.findFirst({
        where: { name: p.name, countryId: created.id },
      });
      if (!exists) {
        await prisma.player.create({
          data: { name: p.name, position: p.pos, countryId: created.id },
        });
        added++;
      }
    }

    console.log(`  ${country.code} (${country.name}): ${added} players added`);
  }

  const total = await prisma.player.count();
  console.log(`\nDone! ${total} players total in DB.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
