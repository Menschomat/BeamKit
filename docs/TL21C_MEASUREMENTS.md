# Neewer TL21C prototype

The [Neewer TL21C product page](https://neewer.com/collections/all-product/products/neewer-tl21c-rgb-magnetic-light-wand-with-app-control-66604585)
lists an overall envelope of 228 × 40 × 45 mm, a USB-C port, rear controls, and
1/4-inch threads on both ends. The two product photos show a curved diffuser and
a flat rear control face. The photos establish feature layout. The display,
button, USB-C and screw positions in the preview are schematic.

The local lightformer STL is a measurement reference only. Assuming millimetres,
its outer bounds are about 50.18 × 80 × 235 mm and represent the accessory.
Sections through its end retainers suggest a cavity roughly 42.4 mm across the
widest part and roughly 38.9 mm across around 35 mm behind the diffuser apex.
The cavity includes unknown allowance for the original design. BeamKit models
an estimated 41.6 mm shoulder, 45 mm depth and a 218 × 35 mm projected emitting
area. These dimensions and the approximately 6.5 mm diffuser sag still need
measurements on the actual lamp. The model and photos stay in the Git-ignored
`etc/` directory. BeamKit uses only original geometry and exports the accessory.

The part clips over the front with a pair of tapered tabs on each long side.
Its side skirts limit spill near the lens. The center of the back and both
threaded end faces stay open. The default honeycomb is about 221.2 × 46.3 × 50.8 mm.
Allow for the full length and any brim on the slicer's usable bed. The fit
coupon is about 19.2 × 46.3 × 42.4 mm and uses the same side clip cross-section.
Both are oriented grille or rim down in the front-down export.

**Fit → Mount style → Slide-on rails** is an alternative to the snap fit. It
slides onto either end and captures the tapered shoulders with four 32 mm-wide
guide sections. Rail thickness defaults to 2.8 mm. The rear controls and the
threaded ends stay exposed. The honeycomb is about 221.2 × 48.1 × 50.8 mm and the
slide-on coupon is about 19.2 × 48.1 × 42.4 mm. The coupon uses the same rail
cross-section to check end-cap entry and sliding fit.

The rails capture the lamp across its width. Both ends of the channel are open,
so it relies on fit and friction to stay centered lengthwise. Check full-length
sliding fit, axial retention, and rail strength before using the mount.

Bambu Studio sliced the default slide-on honeycomb and coupon front-down on the
X1 Carbon 0.4 mm profile at 0.20 mm layer height, with four walls and supports
disabled. Physical print and fit tests are pending.

Mounted light grids and their fit coupon follow the estimated diffuser curve on
the lamp-facing side. **Fit → Diffuser clearance** controls the Z-axis gap and
defaults to 0.8 mm. Grid exits remain on a flat print face, so the cells are
deeper toward the sides. The sheet holder retains its flat sheet pocket.

In BeamKit, choose **Neewer TL21C** from the lamp name above the 3D view. Choose **Print → Fit coupon
only**, print it with the intended material and a 0.4 mm nozzle, and try it across
the unpowered lamp. Check clip insertion, release and retention, clearance at
the diffuser, and access with a USB-C cable and end-mounted plate fitted.
Measure the widest shoulder, the width and front-to-back position where the
clips catch, and the diffuser projection if the coupon needs adjustment. Check
thermal and optical behavior separately before using the full accessory.
