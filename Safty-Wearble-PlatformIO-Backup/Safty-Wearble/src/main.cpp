#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_Sensor.h>

// --- Pins ---
#define BUTTON_PIN 4 
#define MIC_PIN 34
#define BUZZER_PIN 25
#define BUZZER2_PIN 26 // Your new second buzzer!
#define GAS_PIN 35
#define RFID_CS_PIN 14
#define RFID_RST_PIN 27

// --- OLED Settings ---
#define SCREEN_WIDTH 128 
#define SCREEN_HEIGHT 64 
#define OLED_RESET     -1 
#define SCREEN_ADDRESS 0x3C 
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// --- Objects ---
Adafruit_BMP280 bmp; 
MFRC522 mfrc522(RFID_CS_PIN, RFID_RST_PIN);

// --- System State Variables ---
bool systemUnlocked = false;
int currentScreen = 0;       
int lastButtonState = LOW;
uint32_t irBuffer[128]; 

// ==========================================
// FAKE DATA GENERATORS 
// ==========================================
uint32_t getFakeHeartbeat() {
  float time_sec = millis() / 1000.0;
  float beatsPerSecond = 75.0 / 60.0; 
  float wave = sin(2 * PI * beatsPerSecond * time_sec) + 0.3 * cos(4 * PI * beatsPerSecond * time_sec);
  return 50000 + (wave * 10000); 
}
float getFakeAccelX() { return random(-5, 6) / 10.0; }     
float getFakeAccelY() { return random(-5, 6) / 10.0; }     
float getFakeAccelZ() { return 9.8 + random(-2, 3) / 10.0; } 

// ==========================================
// CALIBRATED SENSOR HELPERS
// ==========================================
int getCalibratedSound() {
  int minReading = 4095, maxReading = 0;
  unsigned long startMillis = millis();
  
  while (millis() - startMillis < 50) {
    int sample = analogRead(MIC_PIN);
    if (sample < minReading) minReading = sample;
    if (sample > maxReading) maxReading = sample;
  }
  
  int rawAmplitude = maxReading - minReading;
  
  if (rawAmplitude < 50) {
    rawAmplitude = 0;
  }
  
  int volumePercent = map(rawAmplitude, 0, 800, 0, 100);
  
  if (volumePercent > 100) volumePercent = 100;
  if (volumePercent < 0) volumePercent = 0;
  
  return volumePercent; 
}

int getSmoothedGas() {
  long total = 0;
  for(int i=0; i<10; i++) {
    total += analogRead(GAS_PIN);
    delay(2);
  }
  return total / 10;
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT);
  
  // Setup BOTH buzzers
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUZZER2_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW); 
  digitalWrite(BUZZER2_PIN, LOW); 

  // 1. START I2C AND OLED FIRST
  Wire.begin();
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("OLED failed"));
    for(;;); 
  }
  
  // 2. START HW-611 (BMP280)
  bmp.begin(0x76); 

  // 3. START SPI (RFID Only)
  SPI.begin();
  mfrc522.PCD_Init();

  for(int i=0; i<128; i++) irBuffer[i] = 50000;

  // Draw Lock Screen
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(5, 20);
  display.print(F("LOCKED"));
  display.setTextSize(1);
  display.setCursor(5, 45);
  display.print(F("Scan ID to start..."));
  display.display();
}

void loop() {
  // ==========================================
  // 0. SECURITY LOCK 
  // ==========================================
  if (!systemUnlocked) {
    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
      systemUnlocked = true;
      
      // Double Beep for unlock
      digitalWrite(BUZZER_PIN, HIGH); 
      digitalWrite(BUZZER2_PIN, HIGH);
      delay(200); 
      digitalWrite(BUZZER_PIN, LOW);
      digitalWrite(BUZZER2_PIN, LOW);
      
      display.clearDisplay();
      display.setTextSize(2); display.setCursor(10, 25); display.print(F("UNLOCKED!"));
      display.display();
      delay(1500); 
    }
    return; 
  }

  // ==========================================
  // 1. SAFETY MONITORING
  // ==========================================
  bool isEmergency = false;
  String emergencyCause = "";

  int gasLevel = getSmoothedGas();
  float temp = bmp.readTemperature(); 
  float pres = bmp.readPressure() / 100.0F; 
  float accX = getFakeAccelX(); float accY = getFakeAccelY(); float accZ = getFakeAccelZ();
  float impact = sqrt((accX*accX) + (accY*accY) + (accZ*accZ));
  int volume = getCalibratedSound();

  // --- MASTER EMERGENCY THRESHOLDS ---
  if (gasLevel > 4000) { isEmergency = true; emergencyCause = "GAS LEAK!"; }
  if (impact > 25.0)   { isEmergency = true; emergencyCause = "IMPACT!"; }
  if (volume > 85)     { isEmergency = true; emergencyCause = "EXTREME NOISE!"; }
  
  if (temp > 45.0)     { isEmergency = true; emergencyCause = "HIGH HEAT!"; }
  if (temp < 5.0 && temp != 0.0) { isEmergency = true; emergencyCause = "FREEZING!"; }
  if (pres < 950.0 && pres > 100.0) { isEmergency = true; emergencyCause = "SEVERE STORM!"; }

  // ==========================================
  // 2. EMERGENCY OVERRIDE UI & DUAL ALARM
  // ==========================================
  if (isEmergency) {
    // Sound BOTH buzzers!
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(BUZZER2_PIN, HIGH);
    
    display.clearDisplay();
    if ((millis() / 250) % 2 == 0) display.invertDisplay(true);  
    else display.invertDisplay(false); 
    display.setTextSize(2); display.setCursor(10, 15); display.print(F("EMERGENCY"));
    display.setTextSize(1); display.setCursor(10, 45); display.print(F("CAUSE: ")); display.print(emergencyCause);
    display.display();
    return; 
  } 

  // ==========================================
  // 3. CAROUSEL NAVIGATION & UI
  // ==========================================
  // Turn off both buzzers during normal operation
  digitalWrite(BUZZER_PIN, LOW); 
  digitalWrite(BUZZER2_PIN, LOW); 
  display.invertDisplay(false);  

  int currentButtonState = digitalRead(BUTTON_PIN);
  if (currentButtonState == HIGH && lastButtonState == LOW) {
    currentScreen++; 
    if (currentScreen > 4) currentScreen = 0; 
    delay(50); 
  }
  lastButtonState = currentButtonState;

  display.clearDisplay();
  display.setTextSize(1);
  
  switch(currentScreen) {
    case 0: { // ATMOSPHERE 
      display.setCursor(0, 0); display.println(F("--- ATMOSPHERE ---"));
      display.setCursor(0, 20); display.print(F("Temp: ")); display.print(temp, 1); display.println(F(" C"));
      display.setCursor(0, 40); display.print(F("Pres: ")); display.print(pres, 1); display.println(F(" hPa"));
      break;
    }
    case 1: { // MOTION 
      display.setCursor(0, 0); display.println(F("--- MOTION(NC) ---"));
      display.setCursor(0, 20); display.print(F("X:")); display.print(accX, 1); display.setCursor(64, 20); display.print(F("Y:")); display.println(accY, 1);
      display.setCursor(0, 40); display.print(F("Z:")); display.println(accZ, 1);
      break;
    }
    case 2: { // NOISE LEVEL
      display.setCursor(0, 0); display.println(F("--- SURROUND NOISE ---"));
      display.setTextSize(2); 
      display.setCursor(10, 20); 
      display.print(F("Vol: ")); display.print(volume); display.print(F("%"));
      display.drawRect(10, 45, 100, 10, SSD1306_WHITE); 
      int barWidth = map(volume, 0, 100, 0, 96); 
      display.fillRect(12, 47, barWidth, 6, SSD1306_WHITE); 
      break;
    }
    case 3: { // HEART GRAPH 
      uint32_t irValue = getFakeHeartbeat();
      for (int i = 0; i < 127; i++) irBuffer[i] = irBuffer[i+1];
      irBuffer[127] = irValue;
      uint32_t minVal = irBuffer[0], maxVal = irBuffer[0];
      for(int i=0; i<128; i++){
         if(irBuffer[i] < minVal) minVal = irBuffer[i];
         if(irBuffer[i] > maxVal) maxVal = irBuffer[i];
      }
      if (maxVal == minVal) maxVal = minVal + 1; 
      display.setCursor(0, 0); display.print(F("--- HEART RATE(NC) ---"));
      for(int i=0; i<127; i++){
         int y1 = map(irBuffer[i], minVal, maxVal, 63, 15); 
         int y2 = map(irBuffer[i+1], minVal, maxVal, 63, 15);
         display.drawLine(i, y1, i+1, y2, SSD1306_WHITE);
      }
      break;
    }
    case 4: { // GAS STATUS 
      display.setCursor(0, 0); display.println(F("--- AIR QUALITY ---"));
      display.setCursor(0, 20); display.print(F("Raw Val: ")); display.print(gasLevel);
      display.setTextSize(2);
      display.setCursor(0, 40);
      
      if (gasLevel < 1000) display.print(F("GOOD"));
      else if (gasLevel < 2500) display.print(F("MODERATE"));
      else display.print(F("DANGER!"));
      break;
    }
  }
  display.display();
}