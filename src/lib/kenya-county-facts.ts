// Public, encyclopedic facts for Kenya's 47 counties. Sources: KNBS 2019
// Census, IEBC constituency register, gazetted county headquarters. Numbers
// are rounded; treat this as reference material for the profile UI, not an
// operational dataset.

export type CountyRegion =
  | "Coast"
  | "North Eastern"
  | "Eastern"
  | "Central"
  | "Rift Valley"
  | "Western"
  | "Nyanza"
  | "Nairobi";

export type CountyFacts = {
  code: number;
  name: string;
  headquarters: string;
  region: CountyRegion;
  areaKm2: number;
  population2019: number;
  constituencies: number;
  wards: number;
  governor: string;
  senator: string;
  motto?: string;
  economy: string[];
  landmarks: string[];
};

export const KENYA_COUNTY_FACTS: Record<number, CountyFacts> = {
  1: { code: 1, name: "Mombasa", headquarters: "Mombasa", region: "Coast", areaKm2: 220, population2019: 1208333, constituencies: 6, wards: 30, governor: "Abdulswamad Shariff Nassir", senator: "Mohamed Faki", economy: ["Port logistics", "Tourism", "Manufacturing", "Fisheries"], landmarks: ["Fort Jesus", "Mombasa Port", "Nyali Beach"] },
  2: { code: 2, name: "Kwale", headquarters: "Kwale", region: "Coast", areaKm2: 8270, population2019: 866820, constituencies: 4, wards: 20, governor: "Fatuma Achani", senator: "Issa Boy Juma", economy: ["Tourism", "Titanium mining", "Agriculture", "Fisheries"], landmarks: ["Diani Beach", "Shimba Hills", "Kaya Kinondo"] },
  3: { code: 3, name: "Kilifi", headquarters: "Kilifi", region: "Coast", areaKm2: 12246, population2019: 1453787, constituencies: 7, wards: 35, governor: "Gideon Mung’aro", senator: "Stewart Madzayo", economy: ["Tourism", "Agriculture", "Fisheries", "Cement manufacturing"], landmarks: ["Watamu Marine Park", "Gede Ruins", "Vipingo"] },
  4: { code: 4, name: "Tana River", headquarters: "Hola", region: "Coast", areaKm2: 35376, population2019: 315943, constituencies: 3, wards: 15, governor: "Dhadho Godhana", senator: "Danson Mungatana", economy: ["Livestock", "Irrigated agriculture", "Fisheries"], landmarks: ["Tana Delta", "Tana River Primate Reserve"] },
  5: { code: 5, name: "Lamu", headquarters: "Lamu", region: "Coast", areaKm2: 6273, population2019: 143920, constituencies: 2, wards: 10, governor: "Issa Timamy", senator: "Joseph Githuku", economy: ["Tourism", "Fisheries", "LAPSSET port", "Agriculture"], landmarks: ["Lamu Old Town (UNESCO)", "Manda Bay", "Kiunga Marine Reserve"] },
  6: { code: 6, name: "Taita Taveta", headquarters: "Wundanyi", region: "Coast", areaKm2: 17084, population2019: 340671, constituencies: 4, wards: 20, governor: "Andrew Mwadime", senator: "Johnes Mwaruma", economy: ["Mining (gemstones)", "Sisal", "Tourism (Tsavo)", "Horticulture"], landmarks: ["Tsavo East & West", "Vuria Peak", "Taita Hills"] },
  7: { code: 7, name: "Garissa", headquarters: "Garissa", region: "North Eastern", areaKm2: 45720, population2019: 841353, constituencies: 6, wards: 30, governor: "Nathif Jama", senator: "Abdul Haji", economy: ["Livestock", "Camel trade", "Cross-border commerce", "Fisheries (Tana)"], landmarks: ["Boni Forest", "Tana River bridge", "Garissa University"] },
  8: { code: 8, name: "Wajir", headquarters: "Wajir", region: "North Eastern", areaKm2: 55841, population2019: 781263, constituencies: 6, wards: 30, governor: "Ahmed Abdullahi", senator: "Mohamed Chute", economy: ["Livestock", "Cross-border trade", "Handicrafts"], landmarks: ["Wagalla Airstrip", "Yahut wells"] },
  9: { code: 9, name: "Mandera", headquarters: "Mandera", region: "North Eastern", areaKm2: 25939, population2019: 867457, constituencies: 6, wards: 30, governor: "Mohamed Adan Khalif", senator: "Ali Roba", economy: ["Livestock", "Cross-border trade", "Agriculture (Daua)"], landmarks: ["Border Point One", "Daua River"] },
  10: { code: 10, name: "Marsabit", headquarters: "Marsabit", region: "Eastern", areaKm2: 70961, population2019: 459785, constituencies: 4, wards: 20, governor: "Mohamud Ali", senator: "Chachu Ganya", economy: ["Livestock", "Wind energy (Lake Turkana)", "Tourism"], landmarks: ["Lake Turkana", "Marsabit National Park", "Chalbi Desert"] },
  11: { code: 11, name: "Isiolo", headquarters: "Isiolo", region: "Eastern", areaKm2: 25336, population2019: 268002, constituencies: 3, wards: 10, governor: "Abdi Guyo", senator: "Fatuma Dullo", economy: ["Livestock", "Tourism", "Logistics (LAPSSET)"], landmarks: ["Buffalo Springs", "Shaba National Reserve"] },
  12: { code: 12, name: "Meru", headquarters: "Meru", region: "Eastern", areaKm2: 6936, population2019: 1545714, constituencies: 9, wards: 45, governor: "Kawira Mwangaza", senator: "Kathuri Murungi", economy: ["Miraa (khat)", "Coffee & tea", "Horticulture", "Timber"], landmarks: ["Mount Kenya slopes", "Meru National Park", "Nyambene Hills"] },
  13: { code: 13, name: "Tharaka Nithi", headquarters: "Kathwana", region: "Eastern", areaKm2: 2609, population2019: 393177, constituencies: 3, wards: 15, governor: "Muthomi Njuki", senator: "Mwenda Gataya", economy: ["Coffee", "Tea", "Miraa", "Livestock"], landmarks: ["Mwea Plains", "Chuka University"] },
  14: { code: 14, name: "Embu", headquarters: "Embu", region: "Eastern", areaKm2: 2818, population2019: 608599, constituencies: 4, wards: 20, governor: "Cecily Mbarire", senator: "Alexander Munyi", economy: ["Coffee", "Tea", "Horticulture", "Hydroelectric power"], landmarks: ["Mwea Reservoir", "Seven Forks Dams", "Mt Kenya"] },
  15: { code: 15, name: "Kitui", headquarters: "Kitui", region: "Eastern", areaKm2: 30496, population2019: 1136187, constituencies: 8, wards: 40, governor: "Julius Malombe", senator: "Enock Wambua", economy: ["Livestock", "Charcoal", "Coal (Mui basin)", "Handicrafts"], landmarks: ["South Kitui National Reserve", "Nzambani Rock"] },
  16: { code: 16, name: "Machakos", headquarters: "Machakos", region: "Eastern", areaKm2: 6208, population2019: 1421932, constituencies: 8, wards: 40, governor: "Wavinya Ndeti", senator: "Agnes Kavindu", economy: ["Industry (Konza, EPZ)", "Agriculture", "Real estate", "Trade"], landmarks: ["Konza Technopolis", "Machakos People’s Park"] },
  17: { code: 17, name: "Makueni", headquarters: "Wote", region: "Eastern", areaKm2: 8009, population2019: 987653, constituencies: 6, wards: 30, governor: "Mutula Kilonzo Jr.", senator: "Dan Maanzo", economy: ["Fruits (mango)", "Horticulture", "Livestock", "Sand harvesting"], landmarks: ["Chyulu Hills", "Kibwezi Forest"] },
  18: { code: 18, name: "Nyandarua", headquarters: "Ol Kalou", region: "Central", areaKm2: 3304, population2019: 638289, constituencies: 5, wards: 25, governor: "Kiarie Badilisha", senator: "John Methu", economy: ["Dairy", "Potatoes", "Wheat", "Horticulture"], landmarks: ["Aberdare Ranges", "Lake Ol Bolossat"] },
  19: { code: 19, name: "Nyeri", headquarters: "Nyeri", region: "Central", areaKm2: 3337, population2019: 759164, constituencies: 6, wards: 30, governor: "Mutahi Kahiga", senator: "Wahome Wamatinga", economy: ["Tea", "Coffee", "Dairy", "Tourism"], landmarks: ["Mt Kenya", "Treetops Lodge", "Aberdare NP"] },
  20: { code: 20, name: "Kirinyaga", headquarters: "Kerugoya", region: "Central", areaKm2: 1478, population2019: 610411, constituencies: 4, wards: 20, governor: "Anne Waiguru", senator: "Kamau Murango", economy: ["Rice (Mwea)", "Coffee", "Horticulture"], landmarks: ["Mwea Irrigation Scheme", "Mt Kenya"] },
  21: { code: 21, name: "Murang'a", headquarters: "Murang'a", region: "Central", areaKm2: 2559, population2019: 1056640, constituencies: 7, wards: 35, governor: "Irungu Kang’ata", senator: "Joe Nyutu", economy: ["Tea", "Coffee", "Avocado", "Dairy"], landmarks: ["Mukurwe wa Nyagathanga", "Aberdares"] },
  22: { code: 22, name: "Kiambu", headquarters: "Kiambu", region: "Central", areaKm2: 2543, population2019: 2417735, constituencies: 12, wards: 60, governor: "Kimani Wamatangi", senator: "Karungo Thang’wa", economy: ["Real estate", "Tea & coffee", "Manufacturing", "Retail"], landmarks: ["Tatu City", "Two Rivers", "Paradise Lost"] },
  23: { code: 23, name: "Turkana", headquarters: "Lodwar", region: "Rift Valley", areaKm2: 71597, population2019: 926976, constituencies: 6, wards: 30, governor: "Jeremiah Lomorukai", senator: "James Lomenen", economy: ["Oil (Lokichar)", "Livestock", "Fisheries", "Wind power"], landmarks: ["Lake Turkana", "Central Island", "Sibiloi NP"] },
  24: { code: 24, name: "West Pokot", headquarters: "Kapenguria", region: "Rift Valley", areaKm2: 9169, population2019: 621241, constituencies: 4, wards: 20, governor: "Simon Kachapin", senator: "Julius Murgor", economy: ["Livestock", "Maize", "Mining (marble)"], landmarks: ["Cherengany Hills", "Nasolot Reserve"] },
  25: { code: 25, name: "Samburu", headquarters: "Maralal", region: "Rift Valley", areaKm2: 20826, population2019: 310327, constituencies: 3, wards: 15, governor: "Jonathan Lelelit", senator: "Steve Lelegwe", economy: ["Livestock", "Tourism", "Conservancies"], landmarks: ["Samburu Reserve", "Maralal", "Mt Nyiro"] },
  26: { code: 26, name: "Trans Nzoia", headquarters: "Kitale", region: "Rift Valley", areaKm2: 2496, population2019: 990341, constituencies: 5, wards: 25, governor: "George Natembeya", senator: "Allan Chesang", economy: ["Maize (breadbasket)", "Dairy", "Horticulture"], landmarks: ["Mt Elgon", "Saiwa Swamp", "Kitale Museum"] },
  27: { code: 27, name: "Uasin Gishu", headquarters: "Eldoret", region: "Rift Valley", areaKm2: 2955, population2019: 1163186, constituencies: 6, wards: 30, governor: "Jonathan Bii", senator: "Jackson Mandago", economy: ["Wheat & maize", "Dairy", "Athletics tourism", "Manufacturing"], landmarks: ["Eldoret CBD", "Kipchoge Keino Stadium"] },
  28: { code: 28, name: "Elgeyo Marakwet", headquarters: "Iten", region: "Rift Valley", areaKm2: 3050, population2019: 454480, constituencies: 4, wards: 20, governor: "Wesley Rotich", senator: "William Kisang", economy: ["Athletics tourism", "Horticulture", "Fluorspar", "Dairy"], landmarks: ["Kerio Valley", "Iten (home of champions)"] },
  29: { code: 29, name: "Nandi", headquarters: "Kapsabet", region: "Rift Valley", areaKm2: 2884, population2019: 885711, constituencies: 6, wards: 30, governor: "Stephen Sang", senator: "Samson Cherargei", economy: ["Tea", "Dairy", "Athletics"], landmarks: ["Nandi Hills", "Kingwal Swamp"] },
  30: { code: 30, name: "Baringo", headquarters: "Kabarnet", region: "Rift Valley", areaKm2: 11015, population2019: 666763, constituencies: 6, wards: 30, governor: "Benjamin Cheboi", senator: "William Cheptumo", economy: ["Livestock", "Tourism", "Geothermal", "Honey"], landmarks: ["Lake Baringo", "Lake Bogoria", "Kerio Valley"] },
  31: { code: 31, name: "Laikipia", headquarters: "Nanyuki", region: "Rift Valley", areaKm2: 9462, population2019: 518560, constituencies: 3, wards: 15, governor: "Joshua Irungu", senator: "John Kinyua", economy: ["Ranching", "Tourism", "Horticulture (flowers)", "Conservancies"], landmarks: ["Ol Pejeta", "Mt Kenya", "Segera"] },
  32: { code: 32, name: "Nakuru", headquarters: "Nakuru", region: "Rift Valley", areaKm2: 7495, population2019: 2162202, constituencies: 11, wards: 55, governor: "Susan Kihika", senator: "Tabitha Karanja", economy: ["Horticulture (flowers)", "Manufacturing", "Tourism", "Geothermal"], landmarks: ["Lake Nakuru", "Menengai Crater", "Hell’s Gate"] },
  33: { code: 33, name: "Narok", headquarters: "Narok", region: "Rift Valley", areaKm2: 17921, population2019: 1157873, constituencies: 6, wards: 30, governor: "Patrick Ntutu", senator: "Ledama Ole Kina", economy: ["Tourism (Mara)", "Wheat", "Livestock", "Barley"], landmarks: ["Maasai Mara", "Mau Forest"] },
  34: { code: 34, name: "Kajiado", headquarters: "Kajiado", region: "Rift Valley", areaKm2: 21901, population2019: 1117840, constituencies: 5, wards: 25, governor: "Joseph Ole Lenku", senator: "Samuel Seki", economy: ["Real estate", "Livestock", "Cement (EAPCC)", "Tourism"], landmarks: ["Amboseli", "Magadi Lake", "Ngong Hills"] },
  35: { code: 35, name: "Kericho", headquarters: "Kericho", region: "Rift Valley", areaKm2: 2479, population2019: 901777, constituencies: 6, wards: 30, governor: "Erick Mutai", senator: "Aaron Cheruiyot", economy: ["Tea", "Dairy", "Timber"], landmarks: ["Kericho tea estates", "Chagaik Arboretum"] },
  36: { code: 36, name: "Bomet", headquarters: "Bomet", region: "Rift Valley", areaKm2: 2037, population2019: 875689, constituencies: 5, wards: 25, governor: "Hillary Barchok", senator: "Hillary Sigei", economy: ["Tea", "Dairy", "Maize"], landmarks: ["Mau Forest", "Chepalungu"] },
  37: { code: 37, name: "Kakamega", headquarters: "Kakamega", region: "Western", areaKm2: 3020, population2019: 1867579, constituencies: 12, wards: 60, governor: "Fernandes Barasa", senator: "Boni Khalwale", economy: ["Sugarcane", "Gold mining", "Dairy", "Retail"], landmarks: ["Kakamega Forest", "Crying Stone"] },
  38: { code: 38, name: "Vihiga", headquarters: "Mbale", region: "Western", areaKm2: 531, population2019: 590013, constituencies: 4, wards: 20, governor: "Wilber Ottichilo", senator: "Godfrey Osotsi", economy: ["Tea", "Horticulture", "SME retail"], landmarks: ["Maragoli Hills"] },
  39: { code: 39, name: "Bungoma", headquarters: "Bungoma", region: "Western", areaKm2: 2069, population2019: 1670570, constituencies: 9, wards: 45, governor: "Kenneth Lusaka", senator: "Wakoli Mukhwana", economy: ["Sugarcane", "Maize", "Trade with Uganda"], landmarks: ["Mt Elgon", "Chetambe Hills"] },
  40: { code: 40, name: "Busia", headquarters: "Busia", region: "Western", areaKm2: 1695, population2019: 893681, constituencies: 7, wards: 35, governor: "Paul Otuoma", senator: "Okiya Omtatah", economy: ["Cross-border trade", "Fisheries (Victoria)", "Sugarcane"], landmarks: ["Malaba border", "Sio Port"] },
  41: { code: 41, name: "Siaya", headquarters: "Siaya", region: "Nyanza", areaKm2: 2530, population2019: 993183, constituencies: 6, wards: 30, governor: "James Orengo", senator: "Oburu Oginga", economy: ["Fisheries", "Rice (Yala)", "Sugarcane"], landmarks: ["Lake Victoria", "Kit Mikayi", "Got Ramogi"] },
  42: { code: 42, name: "Kisumu", headquarters: "Kisumu", region: "Nyanza", areaKm2: 2085, population2019: 1155574, constituencies: 7, wards: 35, governor: "Anyang’ Nyong’o", senator: "Tom Ojienda", economy: ["Fisheries", "Manufacturing", "Port logistics", "Sugarcane"], landmarks: ["Kisumu Port", "Impala Sanctuary", "Kit Mikayi"] },
  43: { code: 43, name: "Homa Bay", headquarters: "Homa Bay", region: "Nyanza", areaKm2: 3155, population2019: 1131950, constituencies: 8, wards: 40, governor: "Gladys Wanga", senator: "Moses Kajwang’", economy: ["Fisheries", "Sugarcane", "Cotton"], landmarks: ["Ruma NP", "Rusinga Island", "Mfangano"] },
  44: { code: 44, name: "Migori", headquarters: "Migori", region: "Nyanza", areaKm2: 2586, population2019: 1116436, constituencies: 8, wards: 40, governor: "Ochillo Ayacko", senator: "Eddy Oketch", economy: ["Gold mining", "Sugarcane", "Fisheries", "Tobacco"], landmarks: ["Macalder mines", "Migingo Island"] },
  45: { code: 45, name: "Kisii", headquarters: "Kisii", region: "Nyanza", areaKm2: 1317, population2019: 1266860, constituencies: 9, wards: 45, governor: "Simba Arati", senator: "Richard Onyonka", economy: ["Tea", "Bananas", "Soapstone", "Coffee"], landmarks: ["Manga Ridge", "Tabaka soapstone quarries"] },
  46: { code: 46, name: "Nyamira", headquarters: "Nyamira", region: "Nyanza", areaKm2: 899, population2019: 605576, constituencies: 4, wards: 20, governor: "Amos Nyaribo", senator: "Okong’o Omogeni", economy: ["Tea", "Pyrethrum", "Dairy"], landmarks: ["Manga Escarpment"] },
  47: { code: 47, name: "Nairobi", headquarters: "Nairobi", region: "Nairobi", areaKm2: 696, population2019: 4397073, constituencies: 17, wards: 85, governor: "Johnson Sakaja", senator: "Edwin Sifuna", economy: ["Finance", "ICT/BPO", "Real estate", "Manufacturing", "Retail"], landmarks: ["KICC", "Nairobi NP", "Karura Forest", "Uhuru Park"] },
};

export function getCountyFacts(code: number): CountyFacts | null {
  return KENYA_COUNTY_FACTS[code] ?? null;
}

// Kenya's national Coat of Arms — used as the shared official emblem on
// every county tile. Wikimedia Commons hosts the gazetted version in the
// public domain (Government of Kenya work).
export const KENYA_COAT_OF_ARMS =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Coat_of_arms_of_Kenya_%28Official%29.svg/160px-Coat_of_arms_of_Kenya_%28Official%29.svg.png";