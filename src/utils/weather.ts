export interface WeatherData {
  temp_F: string;
  temp_C: string;
  feelsLike_F: string;
  feelsLike_C: string;
  humidity: string;
  windspeedMiles: string;
  winddir16Point: string;
  weatherDesc: Array<{ value: string }>;
  maxTemp_F: string;
  minTemp_F: string;
  maxTemp_C: string;
  minTemp_C: string;
  pressure: string;
  pressureInches: string;
  visibilityMiles: string;
  cloudcover: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moonPhase: string;
  moonIllumination: string;
  precipInches: string;
  precipMM: string;
  localObsDateTime: string;
  uvIndex: string;
  location: {
    name: string;
    country: string;
    region: string;
  };
}

export const getWeather = async (location: string): Promise<WeatherData> => {
  try {
    const response = await fetch(`https://wttr.in/${location}?format=j2`);
    const data = await response.json();

    const currentWeather = data.current_condition?.[0];
    const astronomy = data.weather?.[0]?.astronomy?.[0];
    const nearestArea = data.nearest_area?.[0];

    if (!currentWeather) {
      throw new Error("Invalid weather data");
    }

    return {
      temp_F: currentWeather.temp_F,
      temp_C: currentWeather.temp_C,
      feelsLike_F: currentWeather.FeelsLikeF,
      feelsLike_C: currentWeather.FeelsLikeC,
      humidity: currentWeather.humidity,
      windspeedMiles: currentWeather.windspeedMiles,
      winddir16Point: currentWeather.winddir16Point,
      weatherDesc: currentWeather.weatherDesc,
      maxTemp_F: data.weather?.[0]?.maxtempF || "N/A",
      minTemp_F: data.weather?.[0]?.mintempF || "N/A",
      maxTemp_C: data.weather?.[0]?.maxtempC || "N/A",
      minTemp_C: data.weather?.[0]?.mintempC || "N/A",
      pressure: currentWeather.pressure,
      pressureInches: currentWeather.pressureInches,
      visibilityMiles: currentWeather.visibilityMiles,
      cloudcover: currentWeather.cloudcover,
      sunrise: astronomy?.sunrise || "N/A",
      sunset: astronomy?.sunset || "N/A",
      moonrise: astronomy?.moonrise || "N/A",
      moonset: astronomy?.moonset || "N/A",
      moonPhase: astronomy?.moon_phase || "N/A",
      moonIllumination: astronomy?.moon_illumination || "N/A",
      precipInches: currentWeather.precipInches,
      precipMM: currentWeather.precipMM,
      localObsDateTime: currentWeather.localObsDateTime,
      uvIndex: currentWeather.uvIndex,
      location: {
        name: nearestArea?.areaName?.[0]?.value || location,
        country: nearestArea?.country?.[0]?.value || "Unknown",
        region: nearestArea?.region?.[0]?.value || "Unknown",
      },
    };
  } catch (error) {
    console.error(error);
    throw new Error("Failed to fetch weather data.");
  }
};
