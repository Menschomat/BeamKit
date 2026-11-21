# P96L reference measurements and access envelopes

The private community STEP supplied by the user was inspected read-only in Fusion
on 2026-11-21. It has one body with 138 faces. This is a measurement reference,
not a production measurement or a source mesh for any generated accessory.
The source directory under `etc/` is ignored; nothing in it enters the build.

The source model uses Z from 0 to 11.5 mm. Its large rear face is at Z=0;
the front aperture is at Z=11.5 mm. The app uses the rigid transform
`(x, y, z) -> (x, y, z - 11.5)` with millimetres and light along +Z.

| Feature | Source model envelope / location in mm | Evidence |
| --- | --- | --- |
| Housing envelope with protrusions | X −55.4…55; Y −30.5…31.2; Z 0…11.5 | Body bounding box |
| USB opening | X −44.5…−34.3; Y −30…−28.5; Z 3.25…7.25 | Faces 47–55 |
| Bottom threaded mount | X about −3.18…3.18; Y −30.5…−24.3; Z 2.58…8.93 | Faces 0–1, 105–106 |
| Top switch | X −37.2…−29.2; Y 27.35…31.2; Z 3.75…7.75 | Faces 60–72 |
| Top button | X −24.6…−20.6; Y 27.35…30.2; Z 3.75…7.75 | Faces 57–59, 74 |
| Left-side dial/control features | X −55.4…−51.5; Y −19.55…19.95; Z 2.1…7.7 | Faces 2–4, 9–21 |

The geometry generator subtracts independent rectangular access envelopes that
surround these features, extend out of the lamp, and allow space for a connector,
finger movement and the screw. It checks the finished solid for zero intersection
with every access envelope. Front clearance starts above the envelopes; cutouts
must never be reduced below these mandatory keepouts by a user setting.

These envelopes intentionally exceed the measured feature bounds. They have not
been checked with a real USB plug, screw head, fingers, or a physical lamp.
Sidewall access slots and rear retaining lips are prototype geometry. Test the
collar before a full accessory, including plugging/unplugging USB and operating
both dials and switches while the lamp is mounted.

Only dimensional facts and original simple primitives are used in public source.
No source B-rep, mesh topology, materials, markings, images or textures are copied.

At the two right-side tab positions (Y = ±8 mm), cross-sections of the
private reference reach X = 54.2 mm through most of the housing depth. The
rear flat face reaches X = 53.5 mm. The default tab inner face is X = 54.5 mm,
with a ramped tip at X = 53.2 mm, behind the rear face. Four narrow bezel seats
set the front contact plane. The effective click force and installation travel
depend on the printed part and still require testing.
