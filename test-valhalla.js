const encodeSignedCoordinate = (value) => {
  let coordinate = value < 0 ? ~(value << 1) : value << 1;
  let output = "";

  while (coordinate >= 0x20) {
    output += String.fromCharCode((0x20 | (coordinate & 0x1f)) + 63);
    coordinate >>= 5;
  }

  return output + String.fromCharCode(coordinate + 63);
};

const encodeValhallaShape = (coordinates, precision = 6) => {
  const factor = 10 ** precision;
  let previousLatitude = 0;
  let previousLongitude = 0;

  return (Array.isArray(coordinates) ? coordinates : []).map((coordinate) => {
    const longitude = Number(coordinate?.[0]);
    const latitude = Number(coordinate?.[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";

    const scaledLatitude = Math.round(latitude * factor);
    const scaledLongitude = Math.round(longitude * factor);
    const encoded = `${encodeSignedCoordinate(scaledLatitude - previousLatitude)}${encodeSignedCoordinate(scaledLongitude - previousLongitude)}`;

    previousLatitude = scaledLatitude;
    previousLongitude = scaledLongitude;

    return encoded;
  }).join("");
};

function decodeValhallaShape(encodedShape, precision = 6) {
  if (!encodedShape || typeof encodedShape !== "string") {
    return [];
  }

  const coordinates = [];
  const factor = 10 ** precision;
  let latitude = 0;
  let longitude = 0;
  let index = 0;

  while (index < encodedShape.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encodedShape.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encodedShape.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([longitude / factor, latitude / factor]);
  }
  return coordinates;
}

const input = [
  [8.681495, 49.41461],
  [8.686507, 49.41943]
];

const encoded = encodeValhallaShape(input);
console.log("Encoded:", encoded);

const decoded = decodeValhallaShape(encoded);
console.log("Decoded:", decoded);
