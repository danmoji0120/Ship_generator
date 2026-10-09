# V1.8.4.1 controlled design comparisons

Seeds: 7, 11, 23. Default yard aegis, Cruiser, 300m, Standard, all priorities 50; only the stated input changes. Each row is the mean of successful designs, not a synthetic Blueprint. Full per-seed inputs, targets, actual counts, reservations, equipment solids, resource use, candidate/replan reasons and failures are in controlled-comparisons.json. Sensor counts are real SENSOR_HOUSING assemblies, not gun mounts.

Resource model: tonnes and cubic metres are engineering reservations including ammunition and maintenance, not an interior simulation. Surface figures include measured exposed eligible hull area and a 5×8-per-host/per-face coherent S-footprint sample estimate, capped below eligible area; every actual mount separately passes final-armor footprint/contact and clearance checks. Unused area does not guarantee a coherent mount or unobstructed firing arc. Structure/propulsion/endurance/sensor use is their committed internal reservation; external equipment solid volumes are recorded separately in JSON.

## A

| Input | Valid seeds | S/M/L/XL | Gun/Missile/PD/Sensor/Spinal | TOP/BOTTOM/PORT/STARBOARD | Resource use t (structure/propulsion/armor/weapons/endurance/sensor) | Resource use m³ (same order) | Weapon surface used / allocated / coherent / eligible m² | Weapon volume utilization | Main omissions / replacements |
|---|---|---|---|---|---|---|---|---|---|
| Corvette | 3/3 | 17.0 / 3.3 / 0.0 / 0.0 | 9.0 / 3.3 / 8.0 / 1.0 / 0.0 | 4.3 / 6.7 / 4.7 / 4.7 | 52255.9 / 107534.8 / 76987.6 / 140490.8 / 51651.3 / 40635.3 | 89581.5 / 184345.5 / 76987.6 / 27921.0 / 88545.0 / 69660.6 | 1148.9 / 36743.2 / 73228.6 / 100976.1 (3.1% of allocation) | 9.1% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement; composition competition; coherent footprint / armor / firing clearance |
| Frigate | 3/3 | 12.3 / 6.7 / 0.0 / 0.0 | 4.7 / 2.7 / 11.7 / 1.0 / 0.0 | 3.7 / 7.3 / 4.0 / 4.0 | 58562.3 / 88375.8 / 93180.8 / 164316.8 / 97680.4 / 68309.0 | 100392.5 / 151501.3 / 93180.8 / 38822.7 / 167452.1 / 117101.1 | 1627.4 / 38940.8 / 83269.0 / 116089.6 (4.2% of allocation) | 11.6% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement; coherent footprint / armor / firing clearance |
| Destroyer | 3/3 | 6.7 / 8.0 / 0.0 / 0.0 | 3.3 / 4.7 / 6.7 / 1.0 / 0.0 | 3.3 / 4.0 / 3.7 / 3.7 | 53501.3 / 88078.2 / 84182.4 / 161523.4 / 66102.9 / 62405.7 | 91716.5 / 150991.2 / 84182.4 / 50990.5 / 113319.2 / 106981.2 | 1701.3 / 36598.9 / 75953.7 / 107486.2 (4.6% of allocation) | 16.5% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement; coherent footprint / armor / firing clearance |
| Cruiser | 3/3 | 6.3 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 6.3 / 1.0 / 0.0 | 3.7 / 5.3 / 2.7 / 2.7 | 59314.9 / 81374.2 / 93180.8 / 173354.2 / 87942.9 / 63421.3 | 101682.7 / 139498.5 / 93180.8 / 54747.0 / 150759.3 / 108722.2 | 2216.4 / 39441.2 / 83269.0 / 116089.6 (5.5% of allocation) | 15.7% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| Battlecruiser | 3/3 | 5.0 / 7.3 / 0.7 / 0.0 | 6.0 / 2.0 / 5.0 / 1.0 / 0.0 | 3.7 / 4.0 / 2.7 / 2.7 | 59459.5 / 122358.8 / 93155.9 / 163823.8 / 73464.4 / 57796.3 | 101930.6 / 209757.9 / 93155.9 / 50852.3 / 125939.0 / 99079.4 | 2175.1 / 39537.4 / 83269.0 / 116089.6 (5.4% of allocation) | 14.9% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement |
| Battleship | 3/3 | 7.7 / 6.7 / 1.3 / 0.0 | 6.7 / 1.3 / 7.7 / 1.0 / 0.0 | 3.0 / 5.3 / 3.7 / 3.7 | 68794.9 / 61346.9 / 104035.6 / 191922.0 / 84998.7 / 60183.5 | 117934.2 / 105166.1 / 104035.6 / 57032.1 / 145712.0 / 103171.8 | 2783.0 / 44603.7 / 96025.6 / 126819.2 (6.1% of allocation) | 13.9% | composition competition; standard-size group replacement; coherent footprint / armor / firing clearance |
| Missile Ship | 3/3 | 7.7 / 8.7 / 0.0 / 0.0 | 1.3 / 8.0 / 7.0 / 1.0 / 0.0 | 5.0 / 5.3 / 3.0 / 3.0 | 58973.9 / 72815.7 / 93180.8 / 183706.1 / 87437.3 / 74521.5 | 101098.1 / 124826.9 / 93180.8 / 63330.5 / 149892.5 / 127751.2 | 1856.8 / 39214.5 / 83269.0 / 116089.6 (4.7% of allocation) | 18.5% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| Spinal Gun Ship | 3/3 | 9.3 / 2.7 / 0.0 / 0.3 | 1.3 / 1.3 / 9.3 / 1.0 / 0.3 | 3.3 / 3.3 / 2.7 / 2.7 | 42763.9 / 46934.2 / 64634.3 / 117979.4 / 58120.0 / 45724.4 | 73309.5 / 80458.7 / 64634.3 / 58006.2 / 99634.2 / 78384.8 | 787.1 / 27683.3 / 52294.3 / 81426.9 (2.8% of allocation) | 20.7% | standard-size group replacement; composition competition; XL host envelope / doctrine; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| Patrol Ship | 3/3 | 21.7 / 0.0 / 0.0 / 0.0 | 8.0 / 0.0 / 13.7 / 1.0 / 0.0 | 1.7 / 8.0 / 6.0 / 6.0 | 53757.5 / 81124.9 / 93155.9 / 106805.9 / 119554.9 / 88831.4 | 92155.7 / 139071.3 / 93155.9 / 4420.0 / 204951.2 / 152282.4 | 670.3 / 35894.6 / 83269.0 / 116572.8 (1.9% of allocation) | 1.4% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement; coherent footprint / armor / firing clearance |

| Input | Engine / casing / radiator / service counts | External engine protection t / m³ | External sensor t / m³ | External thermal / service t / m³ | Equipment omissions |
|---|---|---|---|---|---|
| Corvette | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 374.5 / 1170.3 | 345.4 / 1079.5 |  |
| Frigate | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 470.9 / 1471.5 | 355.4 / 1110.5 |  |
| Destroyer | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 457.1 / 1428.3 | 349.9 / 1093.3 |  |
| Cruiser | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 452.7 / 1414.8 | 355.4 / 1110.5 |  |
| Battlecruiser | 2.3 / 2.3 / 2.0 / 1.0 | 308.9 / 965.2 | 431.9 / 1349.7 | 355.4 / 1110.5 |  |
| Battleship | 2.3 / 2.3 / 2.0 / 1.0 | 335.8 / 1049.4 | 418.6 / 1308.0 | 362.5 / 1132.8 |  |
| Missile Ship | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 493.9 / 1543.5 | 355.4 / 1110.5 |  |
| Spinal Gun Ship | 1.7 / 1.7 / 2.0 / 0.7 | 509.2 / 1591.4 | 369.3 / 1154.1 | 312.8 / 977.4 |  |
| Patrol Ship | 2.3 / 2.3 / 2.0 / 1.0 | 308.9 / 965.2 | 547.0 / 1709.3 | 355.4 / 1110.5 |  |

## B

| Input | Valid seeds | S/M/L/XL | Gun/Missile/PD/Sensor/Spinal | TOP/BOTTOM/PORT/STARBOARD | Resource use t (structure/propulsion/armor/weapons/endurance/sensor) | Resource use m³ (same order) | Weapon surface used / allocated / coherent / eligible m² | Weapon volume utilization | Main omissions / replacements |
|---|---|---|---|---|---|---|---|---|---|
| Light | 3/3 | 1.7 / 2.7 / 0.7 / 0.0 | 1.3 / 2.0 / 1.7 / 1.0 / 0.0 | 3.0 / 0.7 / 0.7 / 0.7 | 32918.6 / 45161.0 / 80704.6 / 78379.1 / 48806.5 / 35197.5 | 86818.2 / 119105.9 / 80704.6 / 28617.5 / 128720.5 / 92828.7 | 1199.9 / 36095.1 / 74836.0 / 106240.8 (3.3% of allocation) | 9.9% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement; composition competition |
| Standard | 3/3 | 6.3 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 6.3 / 1.0 / 0.0 | 3.7 / 5.3 / 2.7 / 2.7 | 59314.9 / 81374.2 / 93180.8 / 173354.2 / 87942.9 / 63421.3 | 101682.7 / 139498.5 / 93180.8 / 54747.0 / 150759.3 / 108722.2 | 2216.4 / 39441.2 / 83269.0 / 116089.6 (5.5% of allocation) | 15.7% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| Heavy | 3/3 | 9.0 / 12.7 / 0.7 / 0.0 | 8.0 / 5.3 / 9.0 / 1.0 / 0.0 | 4.3 / 9.3 / 4.3 / 4.3 | 93202.5 / 127864.5 / 103550.4 / 269808.1 / 138186.1 / 99655.0 | 114125.5 / 156568.8 / 103550.4 / 85359.1 / 169207.5 / 122026.5 | 3295.5 / 42078.6 / 91329.4 / 123852.4 (7.7% of allocation) | 22.0% | standard-size group replacement; composition competition; coherent footprint / armor / firing clearance |
| Superheavy | 3/3 | 12.7 / 16.0 / 0.7 / 0.0 | 10.7 / 6.7 / 12.0 / 1.0 / 0.0 | 6.0 / 10.7 / 6.3 / 6.3 | 132149.8 / 181296.4 / 110372.2 / 339149.8 / 195931.1 / 141298.6 | 122455.4 / 167996.6 / 110372.2 / 103394.8 / 181557.8 / 130933.1 | 4031.9 / 43740.0 / 96480.6 / 128742.6 (9.1% of allocation) | 24.5% | standard-size group replacement; composition competition; coherent footprint / armor / firing clearance |

| Input | Engine / casing / radiator / service counts | External engine protection t / m³ | External sensor t / m³ | External thermal / service t / m³ | Equipment omissions |
|---|---|---|---|---|---|
| Light | 3.0 / 3.0 / 2.0 / 1.0 | 246.3 / 769.7 | 435.9 / 1362.3 | 349.9 / 1093.3 |  |
| Standard | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 452.7 / 1414.8 | 355.4 / 1110.5 |  |
| Heavy | 3.0 / 3.0 / 2.0 / 1.0 | 281.1 / 878.3 | 454.7 / 1421.0 | 359.8 / 1124.3 |  |
| Superheavy | 3.0 / 3.0 / 2.0 / 1.0 | 294.3 / 919.7 | 454.7 / 1421.0 | 362.8 / 1133.6 |  |

## C

| Input | Valid seeds | S/M/L/XL | Gun/Missile/PD/Sensor/Spinal | TOP/BOTTOM/PORT/STARBOARD | Resource use t (structure/propulsion/armor/weapons/endurance/sensor) | Resource use m³ (same order) | Weapon surface used / allocated / coherent / eligible m² | Weapon volume utilization | Main omissions / replacements |
|---|---|---|---|---|---|---|---|---|---|
| 100m | 3/3 | 9.3 / 0.7 / 0.7 / 0.0 | 1.3 / 5.3 / 4.0 / 1.0 / 0.0 | 2.7 / 4.7 / 1.7 / 1.7 | 2196.8 / 3013.9 / 3552.4 / 5523.4 / 3257.1 / 2348.9 | 3766.0 / 5166.6 / 3552.4 / 5383.2 / 5583.7 / 4026.7 | 511.2 / 4258.0 / 7702.9 / 12898.8 (11.4% of allocation) | 38.9% | composition competition; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| 200m | 3/3 | 5.0 / 5.3 / 0.7 / 0.0 | 4.0 / 2.0 / 5.0 / 1.0 / 0.0 | 3.7 / 4.0 / 1.7 / 1.7 | 17574.8 / 24110.9 / 27811.6 / 48716.5 / 26057.2 / 18791.5 | 30128.2 / 41332.9 / 27811.6 / 27743.0 / 44669.4 / 32214.0 | 1374.7 / 17529.4 / 36988.4 / 51595.4 (7.7% of allocation) | 27.4% | composition competition; standard-size group replacement; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| 300m | 3/3 | 6.3 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 6.3 / 1.0 / 0.0 | 3.7 / 5.3 / 2.7 / 2.7 | 59314.9 / 81374.2 / 93180.8 / 173354.2 / 87942.9 / 63421.3 | 101682.7 / 139498.5 / 93180.8 / 54747.0 / 150759.3 / 108722.2 | 2216.4 / 39441.2 / 83269.0 / 116089.6 (5.5% of allocation) | 15.7% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| 500m | 3/3 | 8.7 / 10.0 / 0.7 / 0.0 | 6.7 / 4.0 / 8.7 / 1.0 / 0.0 | 4.0 / 7.3 / 4.0 / 4.0 | 274606.0 / 376732.2 / 428861.3 / 809637.3 / 407143.1 / 293617.2 | 470753.1 / 645826.6 / 428861.3 / 115585.7 / 697959.6 / 503343.7 | 3917.6 / 109558.9 / 245306.4 / 322471.2 (3.5% of allocation) | 7.4% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |

| Input | Engine / casing / radiator / service counts | External engine protection t / m³ | External sensor t / m³ | External thermal / service t / m³ | Equipment omissions |
|---|---|---|---|---|---|
| 100m | 3.0 / 3.0 / 2.0 / 1.0 | 9.8 / 30.8 | 16.8 / 52.4 | 13.2 / 41.1 |  |
| 200m | 3.0 / 3.0 / 2.0 / 1.0 | 78.7 / 246.1 | 134.1 / 419.2 | 105.3 / 329.0 |  |
| 300m | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 452.7 / 1414.8 | 355.4 / 1110.5 |  |
| 500m | 3.0 / 3.0 / 2.0 / 1.0 | 1230.3 / 3844.7 | 2096.1 / 6550.2 | 1645.2 / 5141.4 |  |

## D

| Input | Valid seeds | S/M/L/XL | Gun/Missile/PD/Sensor/Spinal | TOP/BOTTOM/PORT/STARBOARD | Resource use t (structure/propulsion/armor/weapons/endurance/sensor) | Resource use m³ (same order) | Weapon surface used / allocated / coherent / eligible m² | Weapon volume utilization | Main omissions / replacements |
|---|---|---|---|---|---|---|---|---|---|
| firepower=10 | 3/3 | 7.0 / 6.7 / 0.0 / 0.0 | 3.3 / 3.3 / 7.0 / 1.0 / 0.0 | 3.0 / 5.3 / 2.7 / 2.7 | 66273.9 / 90921.2 / 93180.8 / 140490.8 / 98260.7 / 70862.1 | 113612.4 / 155865.0 / 93180.8 / 41277.3 / 168446.8 / 121477.9 | 1462.4 / 30448.6 / 83269.0 / 116089.6 (4.7% of allocation) | 15.3% | standard-size group replacement; coherent footprint / armor / firing clearance |
| firepower=50 | 3/3 | 6.3 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 6.3 / 1.0 / 0.0 | 3.7 / 5.3 / 2.7 / 2.7 | 59314.9 / 81374.2 / 93180.8 / 173354.2 / 87942.9 / 63421.3 | 101682.7 / 139498.5 / 93180.8 / 54747.0 / 150759.3 / 108722.2 | 2216.4 / 39441.2 / 83269.0 / 116089.6 (5.5% of allocation) | 15.7% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| firepower=90 | 3/3 | 5.3 / 9.3 / 0.7 / 0.0 | 7.3 / 2.7 / 5.3 / 1.0 / 0.0 | 4.0 / 5.3 / 3.0 / 3.0 | 53678.5 / 73641.5 / 93180.8 / 196522.9 / 79586.1 / 57394.7 | 92020.2 / 126242.6 / 93180.8 / 61969.5 / 136433.3 / 98390.8 | 2559.2 / 46460.4 / 83269.0 / 116089.6 (5.4% of allocation) | 15.1% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement; coherent footprint / armor / firing clearance |
| survivability=10 | 3/3 | 3.3 / 6.7 / 0.7 / 0.0 | 4.7 / 2.7 / 3.3 / 1.0 / 0.0 | 2.7 / 4.0 / 2.0 / 2.0 | 52455.8 / 71964.2 / 65668.4 / 147227.8 / 77773.3 / 56087.4 | 89924.3 / 123367.2 / 65668.4 / 49244.4 / 133325.7 / 96149.8 | 1999.0 / 41386.5 / 87134.1 / 116458.0 (4.8% of allocation) | 16.3% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement |
| survivability=50 | 3/3 | 6.3 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 6.3 / 1.0 / 0.0 | 3.7 / 5.3 / 2.7 / 2.7 | 59314.9 / 81374.2 / 93180.8 / 173354.2 / 87942.9 / 63421.3 | 101682.7 / 139498.5 / 93180.8 / 54747.0 / 150759.3 / 108722.2 | 2216.4 / 39441.2 / 83269.0 / 116089.6 (5.5% of allocation) | 15.7% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| survivability=90 | 3/3 | 9.0 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 9.0 / 1.0 / 0.0 | 4.3 / 6.7 / 3.0 / 3.0 | 63559.2 / 87196.9 / 123952.5 / 186499.5 / 94235.7 / 67959.5 | 108958.6 / 149480.5 / 123952.5 / 55291.0 / 161547.0 / 116501.9 | 2298.9 / 39252.8 / 88505.6 / 124027.3 (5.8% of allocation) | 14.8% | standard-size group replacement; coherent footprint / armor / firing clearance |
| mobility=10 | 3/3 | 6.7 / 8.0 / 0.7 / 0.0 | 5.3 / 3.3 / 6.7 / 1.0 / 0.0 | 4.0 / 6.0 / 2.7 / 2.7 | 64633.8 / 45938.1 / 94719.1 / 184856.4 / 95828.9 / 69108.4 | 110800.8 / 78751.0 / 94719.1 / 57894.3 / 164278.2 / 118471.6 | 2351.3 / 42778.1 / 83890.0 / 117497.7 (5.4% of allocation) | 15.1% | standard-size group replacement; coherent footprint / armor / firing clearance |
| mobility=50 | 3/3 | 6.3 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 6.3 / 1.0 / 0.0 | 3.7 / 5.3 / 2.7 / 2.7 | 59314.9 / 81374.2 / 93180.8 / 173354.2 / 87942.9 / 63421.3 | 101682.7 / 139498.5 / 93180.8 / 54747.0 / 150759.3 / 108722.2 | 2216.4 / 39441.2 / 83269.0 / 116089.6 (5.5% of allocation) | 15.7% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| mobility=90 | 3/3 | 5.0 / 8.0 / 0.0 / 0.0 | 6.0 / 2.7 / 4.3 / 1.0 / 0.0 | 2.3 / 4.7 / 3.0 / 3.0 | 51971.6 / 105661.3 / 88990.6 / 147885.1 / 77055.5 / 55569.7 | 89094.2 / 181133.7 / 88990.6 / 43485.2 / 132095.1 / 95262.3 | 1649.7 / 38561.2 / 86525.9 / 124207.4 (4.3% of allocation) | 13.8% | standard-size group replacement; composition competition; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| endurance=10 | 3/3 | 7.0 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 7.0 / 1.0 / 0.0 | 3.7 / 6.0 / 2.7 / 2.7 | 61405.7 / 84242.6 / 89536.9 / 176640.5 / 42324.3 / 65656.9 | 105267.0 / 144415.8 / 89536.9 / 54883.0 / 72555.9 / 112554.7 | 2237.0 / 42268.0 / 82607.9 / 114434.0 (5.2% of allocation) | 15.2% | standard-size group replacement; coherent footprint / armor / firing clearance |
| endurance=50 | 3/3 | 6.3 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 6.3 / 1.0 / 0.0 | 3.7 / 5.3 / 2.7 / 2.7 | 59314.9 / 81374.2 / 93180.8 / 173354.2 / 87942.9 / 63421.3 | 101682.7 / 139498.5 / 93180.8 / 54747.0 / 150759.3 / 108722.2 | 2216.4 / 39441.2 / 83269.0 / 116089.6 (5.5% of allocation) | 15.7% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| endurance=90 | 3/3 | 6.3 / 6.7 / 0.7 / 0.0 | 4.7 / 2.7 / 6.3 / 1.0 / 0.0 | 3.7 / 4.7 / 2.7 / 2.7 | 57544.6 / 78945.5 / 96830.8 / 162016.3 / 130973.5 / 61528.5 | 98648.0 / 135335.2 / 96830.8 / 49856.4 / 224526.0 / 105477.4 | 2091.8 / 37025.0 / 84701.6 / 117716.1 (5.6% of allocation) | 14.8% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement; coherent footprint / armor / firing clearance |
| missile=10 | 3/3 | 7.0 / 5.3 / 0.7 / 0.0 | 4.7 / 1.3 / 7.0 / 1.0 / 0.0 | 3.0 / 4.7 / 2.7 / 2.7 | 62869.6 / 86250.8 / 93180.8 / 142627.0 / 93213.2 / 67222.1 | 107776.4 / 147858.5 / 93180.8 / 40211.2 / 159794.1 / 115237.9 | 1863.2 / 34847.8 / 83269.0 / 116089.6 (5.2% of allocation) | 12.8% | standard-size group replacement; coherent footprint / armor / firing clearance |
| missile=50 | 3/3 | 6.3 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 6.3 / 1.0 / 0.0 | 3.7 / 5.3 / 2.7 / 2.7 | 59314.9 / 81374.2 / 93180.8 / 173354.2 / 87942.9 / 63421.3 | 101682.7 / 139498.5 / 93180.8 / 54747.0 / 150759.3 / 108722.2 | 2216.4 / 39441.2 / 83269.0 / 116089.6 (5.5% of allocation) | 15.7% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| missile=90 | 3/3 | 6.3 / 8.7 / 0.7 / 0.0 | 4.7 / 4.7 / 6.3 / 1.0 / 0.0 | 3.7 / 6.0 / 3.0 / 3.0 | 56140.7 / 77019.4 / 93180.8 / 196029.9 / 83236.7 / 60027.3 | 96241.2 / 132033.3 / 93180.8 / 64528.2 / 142691.4 / 102904.0 | 2465.5 / 43483.6 / 83269.0 / 116089.6 (5.6% of allocation) | 17.0% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement; coherent footprint / armor / firing clearance |
| sensor=10 | 3/3 | 7.0 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 7.0 / 1.0 / 0.0 | 3.7 / 6.0 / 2.7 / 2.7 | 63248.6 / 86770.8 / 93180.8 / 176640.5 / 93775.2 / 28705.1 | 108426.2 / 148750.0 / 93180.8 / 54883.0 / 160757.5 / 49208.8 | 2237.0 / 42056.9 / 83269.0 / 116089.6 (5.2% of allocation) | 14.8% | standard-size group replacement; coherent footprint / armor / firing clearance |
| sensor=50 | 3/3 | 6.3 / 7.3 / 0.7 / 0.0 | 4.7 / 3.3 / 6.3 / 1.0 / 0.0 | 3.7 / 5.3 / 2.7 / 2.7 | 59314.9 / 81374.2 / 93180.8 / 173354.2 / 87942.9 / 63421.3 | 101682.7 / 139498.5 / 93180.8 / 54747.0 / 150759.3 / 108722.2 | 2216.4 / 39441.2 / 83269.0 / 116089.6 (5.5% of allocation) | 15.7% | standard-size group replacement; coherent footprint / armor / firing clearance; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| sensor=90 | 3/3 | 6.3 / 6.7 / 0.7 / 0.0 | 4.7 / 2.7 / 6.3 / 3.0 / 0.0 | 3.7 / 4.7 / 2.7 / 2.7 | 55841.8 / 76609.5 / 93180.8 / 162016.3 / 82793.6 / 94072.0 | 95728.9 / 131330.5 / 93180.8 / 49856.4 / 141931.9 / 161266.3 | 2091.8 / 37131.8 / 83269.0 / 116089.6 (5.5% of allocation) | 15.3% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement; coherent footprint / armor / firing clearance |

| Input | Engine / casing / radiator / service counts | External engine protection t / m³ | External sensor t / m³ | External thermal / service t / m³ | Equipment omissions |
|---|---|---|---|---|---|
| firepower=10 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 480.3 / 1501.1 | 355.4 / 1110.5 |  |
| firepower=50 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 452.7 / 1414.8 | 355.4 / 1110.5 |  |
| firepower=90 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 430.4 / 1345.0 | 355.4 / 1110.5 |  |
| survivability=10 | 3.0 / 3.0 / 2.0 / 1.0 | 228.9 / 715.2 | 418.3 / 1307.3 | 354.0 / 1106.3 |  |
| survivability=50 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 452.7 / 1414.8 | 355.4 / 1110.5 |  |
| survivability=90 | 3.0 / 3.0 / 2.0 / 1.0 | 293.7 / 917.7 | 438.5 / 1370.4 | 359.5 / 1123.3 |  |
| mobility=10 | 3.0 / 3.0 / 2.0 / 1.0 | 201.1 / 628.3 | 471.6 / 1473.8 | 356.7 / 1114.8 |  |
| mobility=50 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 452.7 / 1414.8 | 355.4 / 1110.5 |  |
| mobility=90 | 4.0 / 4.0 / 2.0 / 1.0 | 238.8 / 746.4 | 400.7 / 1252.1 | 358.9 / 1121.6 |  |
| endurance=10 | 3.0 / 3.0 / 0.0 / 0.0 | 248.4 / 776.1 | 473.2 / 1478.9 | 0.0 / 0.0 |  |
| endurance=50 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 452.7 / 1414.8 | 355.4 / 1110.5 |  |
| endurance=90 | 3.0 / 3.0 / 2.0 / 2.0 | 283.7 / 886.5 | 435.3 / 1360.3 | 410.5 / 1282.9 |  |
| missile=10 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 466.8 / 1458.9 | 355.4 / 1110.5 |  |
| missile=50 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 452.7 / 1414.8 | 355.4 / 1110.5 |  |
| missile=90 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 440.2 / 1375.5 | 355.4 / 1110.5 |  |
| sensor=10 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 324.0 / 1012.6 | 355.4 / 1110.5 |  |
| sensor=50 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 452.7 / 1414.8 | 355.4 / 1110.5 |  |
| sensor=90 | 3.0 / 3.0 / 2.0 / 1.0 | 265.7 / 830.4 | 594.6 / 1858.1 | 355.4 / 1110.5 |  |

## E

| Input | Valid seeds | S/M/L/XL | Gun/Missile/PD/Sensor/Spinal | TOP/BOTTOM/PORT/STARBOARD | Resource use t (structure/propulsion/armor/weapons/endurance/sensor) | Resource use m³ (same order) | Weapon surface used / allocated / coherent / eligible m² | Weapon volume utilization | Main omissions / replacements |
|---|---|---|---|---|---|---|---|---|---|
| high-firepower | 3/3 | 5.0 / 8.7 / 0.7 / 0.0 | 7.3 / 2.0 / 5.0 / 1.0 / 0.0 | 3.7 / 4.7 / 3.0 / 3.0 | 57953.1 / 60347.9 / 78805.3 / 183541.8 / 62934.2 / 44133.5 | 99348.2 / 103453.5 / 78805.3 / 57010.9 / 107887.2 / 75657.5 | 2424.3 / 49575.8 / 79982.2 / 112524.8 (4.8% of allocation) | 13.9% | Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement |
| high-survivability | 3/3 | 11.0 / 8.0 / 0.0 / 0.0 | 6.0 / 2.0 / 11.0 / 1.0 / 0.0 | 3.7 / 6.0 / 4.7 / 4.7 | 75677.8 / 78804.9 / 122551.3 / 176969.2 / 82182.3 / 57631.5 | 129733.3 / 135094.2 / 122551.3 / 44629.2 / 140883.9 / 98796.9 | 1835.3 / 36108.5 / 89941.3 / 123830.4 (5.0% of allocation) | 13.4% | standard-size group replacement; coherent footprint / armor / firing clearance |
| high-mobility | 3/3 | 5.3 / 6.7 / 0.0 / 0.0 | 5.3 / 2.0 / 4.7 / 1.0 / 0.0 | 3.3 / 3.3 / 2.7 / 2.7 | 56691.5 / 115257.1 / 73985.1 / 128331.4 / 61564.2 / 43172.8 | 97185.4 / 197583.6 / 73985.1 / 35583.3 / 105538.6 / 74010.4 | 1410.8 / 33796.7 / 82459.4 / 117232.3 (4.2% of allocation) | 14.0% | standard-size group replacement; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| high-endurance | 3/3 | 6.0 / 7.0 / 0.0 / 0.0 | 5.7 / 2.0 / 5.3 / 1.0 / 0.0 | 3.7 / 4.0 / 2.7 / 2.7 | 61246.0 / 63776.8 / 80372.2 / 136547.2 / 139397.8 / 46641.2 | 104993.1 / 109331.6 / 80372.2 / 37259.0 / 238967.7 / 79956.3 | 1493.8 / 34377.8 / 86334.6 / 121556.1 (4.3% of allocation) | 13.1% | standard-size group replacement; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| high-missile | 3/3 | 6.3 / 10.0 / 0.0 / 0.0 | 5.3 / 5.3 / 5.7 / 1.0 / 0.0 | 3.0 / 6.0 / 3.7 / 3.7 | 59958.0 / 62435.6 / 76792.6 / 189950.2 / 65111.4 / 45660.3 | 102785.1 / 107032.5 / 76792.6 / 60240.3 / 111619.6 / 78274.8 | 2064.7 / 46834.9 / 87442.1 / 121480.7 (4.4% of allocation) | 16.9% | standard-size group replacement; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| high-sensor | 3/3 | 5.7 / 7.3 / 0.0 / 0.0 | 5.3 / 2.0 / 5.7 / 3.0 / 0.0 | 3.0 / 4.0 / 3.0 / 3.0 | 62224.9 / 64796.1 / 78805.3 / 140819.5 / 67573.1 / 104825.0 | 106671.2 / 111079.1 / 78805.3 / 40461.9 / 115839.6 / 179699.9 | 1545.7 / 33450.7 / 79982.2 / 112524.8 (4.6% of allocation) | 14.9% | standard-size group replacement; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| all-high | 3/3 | 7.3 / 10.7 / 0.0 / 0.0 | 8.0 / 4.0 / 6.0 / 3.0 / 0.0 | 3.3 / 7.3 / 3.7 / 3.7 | 46965.1 / 103245.6 / 136000.7 / 201781.0 / 116209.5 / 86343.5 | 80511.6 / 176992.5 / 136000.7 / 59900.9 / 199216.3 / 148017.5 | 2220.2 / 44097.3 / 89642.9 / 126615.5 (5.0% of allocation) | 13.8% | All priorities high: normalized competing demands within unchanged finite mass and volume; no independent capacity bonuses; Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; standard-size group replacement; composition competition; coherent footprint / armor / firing clearance |

| Input | Engine / casing / radiator / service counts | External engine protection t / m³ | External sensor t / m³ | External thermal / service t / m³ | Equipment omissions |
|---|---|---|---|---|---|
| high-firepower | 3.0 / 3.0 / 0.0 / 1.0 | 213.2 / 666.1 | 393.0 / 1228.1 | 53.6 / 167.5 |  |
| high-survivability | 3.0 / 3.0 / 0.0 / 1.0 | 249.2 / 778.8 | 407.9 / 1274.8 | 59.9 / 187.3 |  |
| high-mobility | 4.0 / 4.0 / 0.0 / 1.0 | 211.8 / 661.9 | 340.3 / 1063.3 | 32.4 / 101.1 |  |
| high-endurance | 3.0 / 3.0 / 2.0 / 2.0 | 225.3 / 704.0 | 344.0 / 1075.1 | 392.6 / 1227.0 |  |
| high-missile | 3.0 / 3.0 / 0.0 / 1.0 | 203.7 / 636.5 | 376.6 / 1177.0 | 33.5 / 104.5 |  |
| high-sensor | 3.0 / 3.0 / 0.0 / 1.0 | 213.2 / 666.1 | 613.4 / 1916.9 | 53.6 / 167.5 |  |
| all-high | 4.0 / 4.0 / 2.0 / 2.0 | 345.7 / 1080.3 | 507.8 / 1587.0 | 417.4 / 1304.3 |  |

## Independent priority sensitivity across seeds

Counts can plateau or reverse when a different coherent whole-group layout wins. These cases are reported, not treated as evidence of success. Each seed delta below is high (90) minus low (10); mass and volume reservation changes should be read alongside actual count changes.

| Priority | Per-seed actual gun / missile / PD / sensor deltas (seeds 7,11,23) | Per-seed weapon mass deltas t | Interpretation |
|---|---|---|---|
| firepower | 5/0/-3/0 · 4/0/0/0 · 3/-2/-2/0 | 83801.6 / 59154.0 / 25140.5 | Actual count changes observed in every successful seed; consistency of direction must also be assessed. |
| survivability | 0/0/7/0 · 0/0/4/0 · 0/2/6/0 | 34506.5 / 19718.0 / 63590.6 | Actual count changes observed in every successful seed; consistency of direction must also be assessed. |
| mobility | 1/0/-5/0 · 0/0/0/0 · 1/-2/-2/0 | -34506.5 / -22675.7 / -53731.6 | 1 seeds have unchanged counts: inspect target differences and rejected footprint/clearance candidates; resource allocation alone is not actual count sensitivity. |
| endurance | 0/0/-2/0 · 0/0/0/0 · 0/-2/0/0 | -9859.0 / 0.0 / -34013.6 | 1 seeds have unchanged counts: inspect target differences and rejected footprint/clearance candidates; resource allocation alone is not actual count sensitivity. |
| missile | 0/4/-2/0 · 0/4/0/0 · 0/2/0/0 | 58168.1 / 68027.1 / 34013.6 | Actual count changes observed in every successful seed; consistency of direction must also be assessed. |
| sensor | 0/0/-2/2 · 0/0/0/2 · 0/-2/0/2 | -9859.0 / 0.0 / -34013.6 | Actual count changes observed in every successful seed; consistency of direction must also be assessed. |

Generated 126/126 designs; rejected cases remain in the report.
