const form = document.getElementById("farmForm");
const result = document.getElementById("result");
const advice = document.getElementById("advice");
const risk = document.getElementById("risk");
const steps = document.getElementById("steps");
const speechText = document.getElementById("speechText");
const submitBtn = document.getElementById("submitBtn");
const diseaseCard = document.getElementById("diseaseCard");
const diseaseDiagnosis = document.getElementById("diseaseDiagnosis");

let currentLang = "en";
let currentTemp = null;
let currentCondition = "";

const cropNames = {
  cotton: "Cotton",
  rice: "Rice",
  maize: "Maize",
  chilli: "Chilli",
  turmeric: "Turmeric",
  groundnut: "Groundnut"
};

// 1. LIVE WEATHER INTEGRATION (Open-Meteo API)
async function fetchLiveWeather() {
  if (!navigator.geolocation) {
    document.getElementById("weatherDesc").textContent = "Geolocation unavailable";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`
        );
        const data = await res.json();

        currentTemp = Math.round(data.current.temperature_2m);
        const humidity = data.current.relative_humidity_2m;
        const code = data.current.weather_code;

        const info = mapWeatherCode(code);
        currentCondition = info.text;

        document.getElementById("weatherCity").textContent = "Local Field Conditions";
        document.getElementById("weatherDesc").textContent = `${info.text}`;
        document.getElementById("weatherIcon").textContent = info.icon;
        document.getElementById("liveTemp").textContent = `${currentTemp}°C`;
        document.getElementById("liveHumidity").textContent = `${humidity}%`;
      } catch (err) {
        document.getElementById("weatherDesc").textContent = "Failed to load weather";
      }
    },
    () => {
      document.getElementById("weatherCity").textContent = "Location Denied";
      document.getElementById("weatherDesc").textContent = "Enable GPS for live weather";
    }
  );
}

function mapWeatherCode(code) {
  if (code === 0) return { text: "Clear sky", icon: "☀️" };
  if (code <= 3) return { text: "Partly cloudy", icon: "⛅" };
  if (code <= 48) return { text: "Foggy conditions", icon: "🌫️" };
  if (code <= 67) return { text: "Rain showers", icon: "🌧️" };
  if (code <= 77) return { text: "Snowfall", icon: "❄️" };
  if (code >= 95) return { text: "Thunderstorm", icon: "⛈️" };
  return { text: "Overcast", icon: "☁️" };
}

window.addEventListener("DOMContentLoaded", fetchLiveWeather);

// 2. IMAGE DIAGNOSIS VIA GEMINI VISION
async function analyzeCropImage(file, cropName, lang) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(",")[1];
        const response = await fetch("/api/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type,
            crop: cropName,
            language: lang
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Diagnosis failed");
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

// 3. ADVICE GENERATION
function makeAdvice(crop, water, stage, soil) {
  let risk = "LOW";
  let adviceText = "";
  let steps = [];

  const w = (water || "").toLowerCase();
  const st = (stage || "").toLowerCase();
  const sType = (soil || "").toLowerCase();

  // Dynamic Risk Assessment
  if (w.includes("low") || w.includes("deficit") || currentTemp > 34) {
    risk = "HIGH";
  } else if (w.includes("excess") || st.includes("flower") || sType.includes("sandy")) {
    risk = "MODERATE";
  } else {
    risk = "LOW";
  }

  // Bilingual Field Advice
  if (currentLang === "te") {
    adviceText = `${cropNames[crop] || crop} పంట (${st} దశ): పొలంలో తేమ మరియు తెగుళ్ల తీవ్రతను గమనించండి.`;
    steps = [
      ["పరిశీలన", "ఆకుల కింద భాగంలో రసం పీల్చే పురుగులు లేదా మచ్చలను గమనించండి."],
      ["నీటి యాజమాన్యం", risk === "HIGH" ? "నేలలో తేమ తక్కువగా ఉంది, వెంటనే తేలికపాటి తడులు ఇవ్వండి." : "పంటకు తగిన మోతాదులో నీటి వసతిని కొనసాగించండి."],
      ["రక్షణ చర్యలు", "తెగుళ్ల నివారణకు వేప నూనె లేదా తగిన సేంద్రియ మందులను పిచికారీ చేయండి."]
    ];
  } else {
    adviceText = `For ${cropNames[crop] || crop} at the ${st} stage, monitor the field regularly for pests and soil moisture.`;
    steps = [
      ["Inspect", "Check undersides of leaves across rows for leaf spots or sucking pests."],
      ["Water", risk === "HIGH" ? "Moisture stress detected; apply timely irrigation to protect roots." : "Maintain uniform shallow watering based on soil absorption."],
      ["Protect", "Use neem oil spray as a preventive measure before applying chemicals."]
    ];
  }

  return { a: adviceText, r: risk, s: steps };
}

// 4. SUBMIT HANDLER
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const crop = document.getElementById("crop").value;
  const water = document.getElementById("water").value;
  const stage = document.getElementById("stage").value;
  const soil = document.getElementById("soil").value;
  const photoInput = document.getElementById("photo");
  submitBtn.disabled = true;
  submitBtn.textContent = "⏳ Processing...";

// Check if image upload analysis is requested
  if (photoInput.files.length > 0) {
    const diseaseTitle = document.getElementById("diseaseTitle");
    const diseaseDetails = document.getElementById("diseaseDetails");
    const diseaseTreatment = document.getElementById("diseaseTreatment");

    diseaseCard.classList.remove("hidden");
    diseaseTitle.textContent = currentLang === "te" ? "విశ్లేషిస్తోంది..." : "Analyzing...";
    diseaseDetails.textContent = "";
    diseaseTreatment.innerHTML = "";

    try {
      const result = await analyzeCropImage(photoInput.files[0], cropNames[crop], currentLang);
      diseaseTitle.textContent = result.problem;
      diseaseDetails.textContent = result.details;
    diseaseTreatment.innerHTML = "";
      if (Array.isArray(result.treatment)) {
        result.treatment.forEach((point) => {
          const li = document.createElement("li");
          li.textContent = point;
          diseaseTreatment.appendChild(li);
        });
      } else {
        const li = document.createElement("li");
        li.textContent = result.treatment;
        diseaseTreatment.appendChild(li);
      }
    } catch (err) {
      diseaseTitle.textContent = "Error";
      diseaseDetails.textContent = "Image diagnosis failed: " + err.message;
    }
  }

  const x = makeAdvice(crop, water, stage, soil);
  document.getElementById("resultTitle").textContent = `${cropNames[crop]} — Field Guidance`;
  advice.textContent = x.a;
  risk.textContent = x.r;
  risk.style.color = x.r === "HIGH" ? "#b43b2f" : x.r === "LOW" ? "#3f8446" : "#a56a12";
  steps.innerHTML = x.s
    .map((v) => `<div class="step"><b>${v[0]} ${v[1]}</b><p>Recommended agronomy step.</p></div>`)
    .join("");

  submitBtn.disabled = false;
  submitBtn.textContent = "✨ Get Smart Advice";

  result.classList.remove("hidden");
  result.scrollIntoView({ behavior: "smooth" });
});

// Voice controls
document.getElementById("readBtn").onclick = () => {
  window.speechSynthesis.cancel();

  let text = advice.textContent || "";
  if (!diseaseCard.classList.contains("hidden")) {
    const title = document.getElementById("diseaseTitle")?.textContent || "";
    const details = document.getElementById("diseaseDetails")?.textContent || "";
    const treatment = document.getElementById("diseaseTreatment")?.textContent || "";
    text = `${title}. ${details}. ${treatment}. ${text}`;
  }

  if (!text.trim()) return;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = currentLang === "te" ? "te-IN" : "en-IN";
  u.rate = 0.9;
  speechSynthesis.speak(u);
};

document.getElementById("micBtn").onclick = () => {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) {
    speechText.textContent = "Voice input not supported in this browser. Try Google Chrome.";
    return;
  }
  const r = new R();
  r.lang = "en-IN";
  r.start();
  speechText.textContent = "🎙️ Listening...";
  r.onresult = (e) => {
    speechText.textContent = "Recognized: " + e.results[0][0].transcript;
  };
  r.onerror = () => {
    speechText.textContent = "Audio capture error. Try again.";
  };
};

document.getElementById("langBtn").onclick = () => {
  currentLang = currentLang === "en" ? "te" : "en";
  document.getElementById("langBtn").textContent = currentLang === "te" ? "English" : "తెలుగు";

  const resultSection = document.getElementById("result");
  if (resultSection && !resultSection.classList.contains("hidden")) {
    document.getElementById("farmForm").dispatchEvent(new Event("submit"));
  }
};