export interface LatLngBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MandalData {
  name: string;
}

export interface DistrictData {
  name: string;
  bounds: LatLngBounds;
  mandals: string[];
}

export interface StateData {
  name: string;
  bounds: LatLngBounds;
  districts: DistrictData[];
}

export const INDIA_BOUNDS: LatLngBounds = {
  north: 37.6,
  south: 6.4,
  east: 97.4,
  west: 68.1,
};

export const INDIA_LOCATIONS: StateData[] = [
  {
    name: "Andhra Pradesh",
    bounds: { north: 19.9, south: 12.6, east: 84.8, west: 76.7 },
    districts: [
      { name: "Visakhapatnam", bounds: { north: 18.3, south: 17.5, east: 83.5, west: 82.7 }, mandals: ["Visakhapatnam", "Bheemunipatnam", "Anakapalle", "Parawada", "Gajuwaka", "Bhimili", "Sabbavaram", "Chodavaram", "Madugula", "Araku Valley"] },
      { name: "Vijayawada (Krishna)", bounds: { north: 16.8, south: 15.9, east: 81.2, west: 80.2 }, mandals: ["Vijayawada", "Machilipatnam", "Gudivada", "Nuzvid", "Jaggayyapeta", "Nandigama", "Tiruvuru", "Vissannapet", "Gannavaram", "Bantumilli"] },
      { name: "Guntur", bounds: { north: 16.5, south: 15.4, east: 80.5, west: 79.2 }, mandals: ["Guntur", "Tenali", "Narasaraopet", "Bapatla", "Mangalagiri", "Sattenapalle", "Ponnur", "Vinukonda", "Repalle", "Tadepalli"] },
      { name: "Kurnool", bounds: { north: 16.1, south: 14.9, east: 79.3, west: 77.6 }, mandals: ["Kurnool", "Nandyal", "Adoni", "Dhone", "Yemmiganur", "Pattikonda", "Alur", "Kodumur", "Mantralayam", "Atmakur"] },
      { name: "Tirupati (Chittoor)", bounds: { north: 13.9, south: 12.7, east: 79.8, west: 78.6 }, mandals: ["Tirupati", "Chittoor", "Madanapalle", "Srikalahasti", "Punganur", "Palamaner", "Satyavedu", "Nagalapuram", "Renigunta", "Chandragiri"] },
      { name: "Kadapa", bounds: { north: 15.1, south: 13.8, east: 79.5, west: 77.8 }, mandals: ["Kadapa", "Proddatur", "Rajampet", "Mydukur", "Jammalamadugu", "Badvel", "Pulivendla", "Kamalapuram", "Rayachoti", "Vempalle"] },
      { name: "Anantapur", bounds: { north: 15.2, south: 13.7, east: 78.0, west: 76.8 }, mandals: ["Anantapur", "Hindupur", "Guntakal", "Dharmavaram", "Kadiri", "Tadipatri", "Rayadurg", "Gooty", "Uravakonda", "Penukonda"] },
      { name: "Srikakulam", bounds: { north: 19.0, south: 18.0, east: 84.7, west: 83.4 }, mandals: ["Srikakulam", "Narasannapeta", "Palakonda", "Rajam", "Amadalavalasa", "Etcherla", "Tekkali", "Kaviti", "Hiramandalam", "Pathapatnam"] },
      { name: "Vizianagaram", bounds: { north: 18.8, south: 17.9, east: 84.0, west: 82.8 }, mandals: ["Vizianagaram", "Bobbili", "Parvathipuram", "Salur", "Srungavarapukota", "Gajapathinagaram", "Nellimarla", "Cheepurupalli", "Bhogapuram", "Badangi"] },
      { name: "West Godavari", bounds: { north: 17.4, south: 16.2, east: 81.4, west: 80.3 }, mandals: ["Eluru", "Bhimavaram", "Tadepalligudem", "Narsapur", "Palacole", "Tanuku", "Jangareddigudem", "Kovvur", "Akividu", "Palakollu"] },
      { name: "East Godavari", bounds: { north: 17.7, south: 16.4, east: 82.5, west: 81.1 }, mandals: ["Kakinada", "Rajahmundry", "Amalapuram", "Pithapuram", "Tuni", "Ramachandrapuram", "Mandapeta", "Samalkot", "Prathipadu", "Mummidivaram"] },
      { name: "Prakasam", bounds: { north: 16.2, south: 14.8, east: 80.4, west: 78.7 }, mandals: ["Ongole", "Chirala", "Kandukur", "Markapur", "Giddalur", "Podili", "Darsi", "Addanki", "Cumbum", "Pamuru"] },
      { name: "Nellore (SPSR)", bounds: { north: 15.0, south: 13.5, east: 80.3, west: 79.0 }, mandals: ["Nellore", "Gudur", "Kavali", "Sullurpeta", "Atmakur", "Kovur", "Venkatagiri", "Allur", "Buchireddipalem", "Podalakur"] }
    ]
  },
  {
    name: "Arunachal Pradesh",
    bounds: { north: 29.5, south: 26.6, east: 97.4, west: 91.5 },
    districts: [
      { name: "Itanagar (Capital Complex)", bounds: { north: 27.3, south: 26.9, east: 93.9, west: 93.4 }, mandals: ["Itanagar", "Naharlagun", "Nirjuli", "Banderdewa"] },
      { name: "Tawang", bounds: { north: 28.1, south: 27.0, east: 92.2, west: 91.6 }, mandals: ["Tawang", "Zemithang", "Lumla"] },
      { name: "Bomdila (West Kameng)", bounds: { north: 27.6, south: 26.8, east: 92.7, west: 91.9 }, mandals: ["Bomdila", "Dirang", "Kalaktang", "Singchung"] },
      { name: "Ziro (Lower Subansiri)", bounds: { north: 28.0, south: 27.2, east: 94.0, west: 93.4 }, mandals: ["Ziro", "Daporijo", "Along (Aalo)"] },
      { name: "Pasighat (East Siang)", bounds: { north: 28.4, south: 27.8, east: 95.4, west: 94.8 }, mandals: ["Pasighat", "Mebo", "Nari"] },
      { name: "Along (West Siang)", bounds: { north: 29.0, south: 27.8, east: 95.0, west: 93.8 }, mandals: ["Along", "Mechukha", "Liromoba"] },
      { name: "Roing (Lower Dibang Valley)", bounds: { north: 28.5, south: 27.8, east: 96.2, west: 95.5 }, mandals: ["Roing", "Dambuk", "Hunli"] },
      { name: "Tezu (Lohit)", bounds: { north: 28.5, south: 27.8, east: 97.0, west: 96.0 }, mandals: ["Tezu", "Wakro", "Namsai"] },
      { name: "Changlang", bounds: { north: 28.0, south: 27.0, east: 97.3, west: 96.0 }, mandals: ["Changlang", "Margherita", "Miao", "Nampong"] },
      { name: "Tirap", bounds: { north: 27.4, south: 26.7, east: 95.8, west: 94.9 }, mandals: ["Khonsa", "Deomali", "Narottam Nagar"] }
    ]
  },
  {
    name: "Assam",
    bounds: { north: 28.2, south: 24.1, east: 96.0, west: 89.7 },
    districts: [
      { name: "Guwahati (Kamrup Metro)", bounds: { north: 26.3, south: 25.9, east: 91.9, west: 91.4 }, mandals: ["Guwahati", "Dispur", "Jalukbari", "Azara", "North Guwahati"] },
      { name: "Dibrugarh", bounds: { north: 27.7, south: 27.2, east: 95.3, west: 94.7 }, mandals: ["Dibrugarh", "Naharkatia", "Moran", "Barbaruah", "Tingkhong"] },
      { name: "Silchar (Cachar)", bounds: { north: 24.9, south: 24.3, east: 93.1, west: 92.5 }, mandals: ["Silchar", "Sonai", "Udharbond", "Lakhipur", "Dholai"] },
      { name: "Jorhat", bounds: { north: 26.9, south: 26.5, east: 94.6, west: 94.0 }, mandals: ["Jorhat", "Titabar", "Mariani", "Teok"] },
      { name: "Tezpur (Sonitpur)", bounds: { north: 26.9, south: 26.3, east: 93.1, west: 92.5 }, mandals: ["Tezpur", "Dhekiajuli", "Biswanath Chariali", "Rangapara"] },
      { name: "Nagaon", bounds: { north: 26.6, south: 25.8, east: 92.9, west: 91.9 }, mandals: ["Nagaon", "Dhing", "Hojai", "Lanka", "Kaliabor"] },
      { name: "Bongaigaon", bounds: { north: 26.7, south: 26.1, east: 90.7, west: 90.1 }, mandals: ["Bongaigaon", "Abhayapuri", "Jogighopa", "Sidli"] },
      { name: "Kokrajhar", bounds: { north: 26.7, south: 26.1, east: 90.4, west: 89.8 }, mandals: ["Kokrajhar", "Gossaigaon", "Chirang"] },
      { name: "Lakhimpur", bounds: { north: 27.3, south: 26.8, east: 94.3, west: 93.7 }, mandals: ["North Lakhimpur", "Dhakuakhana", "Jonai"] },
      { name: "Goalpara", bounds: { north: 26.5, south: 25.9, east: 90.8, west: 90.2 }, mandals: ["Goalpara", "Dudhnoi", "Krishnai", "Lakhipur"] }
    ]
  },
  {
    name: "Bihar",
    bounds: { north: 27.5, south: 24.3, east: 88.3, west: 83.3 },
    districts: [
      { name: "Patna", bounds: { north: 25.9, south: 25.3, east: 85.5, west: 84.7 }, mandals: ["Patna", "Patna Sahib", "Danapur", "Phulwari", "Masaurhi", "Barh", "Mokameh", "Fatuha"] },
      { name: "Gaya", bounds: { north: 25.0, south: 24.4, east: 85.3, west: 84.6 }, mandals: ["Gaya", "Bodh Gaya", "Sherghati", "Jehanabad", "Nawada", "Rafiganj", "Aurangabad"] },
      { name: "Muzaffarpur", bounds: { north: 26.4, south: 25.8, east: 85.6, west: 84.8 }, mandals: ["Muzaffarpur", "Sitamarhi", "Bettiah (West Champaran)", "Motihari (East Champaran)"] },
      { name: "Bhagalpur", bounds: { north: 25.5, south: 24.9, east: 87.4, west: 86.6 }, mandals: ["Bhagalpur", "Banka", "Kahalgaon", "Naugachia"] },
      { name: "Darbhanga", bounds: { north: 26.3, south: 25.7, east: 86.2, west: 85.6 }, mandals: ["Darbhanga", "Madhubani", "Samastipur", "Begusarai"] },
      { name: "Purnea", bounds: { north: 25.9, south: 25.3, east: 87.8, west: 87.1 }, mandals: ["Purnea", "Kishanganj", "Araria", "Katihar"] },
      { name: "Ara (Bhojpur)", bounds: { north: 25.7, south: 25.1, east: 84.8, west: 84.2 }, mandals: ["Ara", "Buxar", "Sasaram (Rohtas)", "Bhabua (Kaimur)"] },
      { name: "Begusarai", bounds: { north: 25.7, south: 25.2, east: 86.3, west: 85.7 }, mandals: ["Begusarai", "Rosera", "Teghra", "Bachhwara"] }
    ]
  },
  {
    name: "Chhattisgarh",
    bounds: { north: 24.1, south: 17.8, east: 84.4, west: 80.2 },
    districts: [
      { name: "Raipur", bounds: { north: 21.5, south: 20.9, east: 82.2, west: 81.5 }, mandals: ["Raipur", "Dhamtari", "Mahasamund", "Baloda Bazar", "Gariyaband"] },
      { name: "Bilaspur", bounds: { north: 22.3, south: 21.7, east: 82.4, west: 81.8 }, mandals: ["Bilaspur", "Korba", "Raigarh", "Janjgir", "Champa"] },
      { name: "Durg", bounds: { north: 21.5, south: 20.9, east: 81.4, west: 80.8 }, mandals: ["Durg", "Bhilai", "Rajnandgaon", "Kawardha", "Balod"] },
      { name: "Jagdalpur (Bastar)", bounds: { north: 19.5, south: 18.9, east: 82.3, west: 81.6 }, mandals: ["Jagdalpur", "Kondagaon", "Kanker", "Narayanpur", "Dantewada"] },
      { name: "Ambikapur (Surguja)", bounds: { north: 24.0, south: 23.0, east: 83.4, west: 82.5 }, mandals: ["Ambikapur", "Surajpur", "Balrampur", "Jashpur", "Koriya"] }
    ]
  },
  {
    name: "Goa",
    bounds: { north: 15.8, south: 14.9, east: 74.3, west: 73.7 },
    districts: [
      { name: "North Goa", bounds: { north: 15.8, south: 15.3, east: 74.3, west: 73.7 }, mandals: ["Panaji", "Mapusa", "Bicholim", "Calangute", "Pernem", "Bardez", "Sattari", "Tiswadi"] },
      { name: "South Goa", bounds: { north: 15.5, south: 14.9, east: 74.2, west: 73.9 }, mandals: ["Margao", "Vasco da Gama", "Ponda", "Quepem", "Canacona", "Sanguem", "Salcete", "Mormugao"] }
    ]
  },
  {
    name: "Gujarat",
    bounds: { north: 24.7, south: 20.1, east: 74.5, west: 68.2 },
    districts: [
      { name: "Ahmedabad", bounds: { north: 23.2, south: 22.7, east: 72.8, west: 72.2 }, mandals: ["Ahmedabad", "Gandhinagar", "Sanand", "Dholka", "Viramgam", "Daskroi", "Detroj-Rampura", "Bavla"] },
      { name: "Surat", bounds: { north: 21.4, south: 20.8, east: 73.2, west: 72.6 }, mandals: ["Surat", "Navsari", "Bharuch", "Bardoli", "Mangrol", "Olpad", "Mandvi", "Kamrej"] },
      { name: "Vadodara", bounds: { north: 22.5, south: 21.9, east: 73.5, west: 72.9 }, mandals: ["Vadodara", "Anand", "Kheda", "Godhra", "Chhota Udaipur", "Waghodia", "Karjan"] },
      { name: "Rajkot", bounds: { north: 22.5, south: 22.0, east: 70.9, west: 70.3 }, mandals: ["Rajkot", "Jamnagar", "Morbi", "Junagadh", "Gondal", "Jasdan", "Lodhika"] },
      { name: "Bhavnagar", bounds: { north: 21.8, south: 21.3, east: 72.3, west: 71.8 }, mandals: ["Bhavnagar", "Botad", "Mahuva", "Palitana", "Sihor", "Ghogha"] },
      { name: "Gandhinagar", bounds: { north: 23.4, south: 22.9, east: 72.8, west: 72.3 }, mandals: ["Gandhinagar", "Mansa", "Dehgam", "Kalol"] },
      { name: "Mehsana", bounds: { north: 23.9, south: 23.4, east: 72.6, west: 72.0 }, mandals: ["Mehsana", "Patan", "Unjha", "Visnagar", "Becharaji", "Kheralu"] },
      { name: "Kutch", bounds: { north: 24.1, south: 22.7, east: 70.7, west: 68.2 }, mandals: ["Bhuj", "Mandvi", "Anjar", "Gandhidham", "Nakhatrana", "Rapar", "Mundra"] }
    ]
  },
  {
    name: "Haryana",
    bounds: { north: 30.9, south: 27.7, east: 77.6, west: 74.5 },
    districts: [
      { name: "Gurugram", bounds: { north: 28.5, south: 28.1, east: 77.1, west: 76.7 }, mandals: ["Gurugram", "Faridabad", "Palwal", "Mewat (Nuh)", "Rewari", "Mahendragarh"] },
      { name: "Ambala", bounds: { north: 30.6, south: 30.0, east: 77.1, west: 76.4 }, mandals: ["Ambala", "Panchkula", "Yamuna Nagar", "Kurukshetra", "Kaithal"] },
      { name: "Hisar", bounds: { north: 29.4, south: 28.8, east: 76.0, west: 75.4 }, mandals: ["Hisar", "Fatehabad", "Sirsa", "Bhiwani", "Charkhi Dadri"] },
      { name: "Rohtak", bounds: { north: 28.9, south: 28.4, east: 76.8, west: 76.2 }, mandals: ["Rohtak", "Jhajjar", "Sonipat", "Panipat", "Karnal"] },
      { name: "Karnal", bounds: { north: 30.0, south: 29.4, east: 77.2, west: 76.6 }, mandals: ["Karnal", "Panipat", "Kaithal", "Jind", "Fatehabad"] }
    ]
  },
  {
    name: "Himachal Pradesh",
    bounds: { north: 33.2, south: 30.4, east: 79.0, west: 75.6 },
    districts: [
      { name: "Shimla", bounds: { north: 31.4, south: 30.8, east: 77.5, west: 76.9 }, mandals: ["Shimla", "Rampur", "Rohru", "Chopal", "Jubbal", "Theog", "Nankhari"] },
      { name: "Manali (Kullu)", bounds: { north: 32.4, south: 31.6, east: 77.5, west: 76.8 }, mandals: ["Kullu", "Manali", "Banjar", "Anni", "Nirmand"] },
      { name: "Dharamsala (Kangra)", bounds: { north: 32.5, south: 31.7, east: 76.6, west: 75.8 }, mandals: ["Dharamsala", "Palampur", "Kangra", "Nurpur", "Dehra", "Hamirpur"] },
      { name: "Solan", bounds: { north: 31.2, south: 30.6, east: 77.3, west: 76.7 }, mandals: ["Solan", "Baddi", "Nalagarh", "Kasauli", "Kandaghat"] },
      { name: "Mandi", bounds: { north: 32.1, south: 31.4, east: 77.0, west: 76.3 }, mandals: ["Mandi", "Sundernagar", "Jogindernagar", "Sarkaghat"] }
    ]
  },
  {
    name: "Jharkhand",
    bounds: { north: 25.3, south: 21.9, east: 87.9, west: 83.3 },
    districts: [
      { name: "Ranchi", bounds: { north: 23.7, south: 22.9, east: 85.5, west: 84.8 }, mandals: ["Ranchi", "Hatia", "Kanke", "Namkum", "Ormanjhi", "Angara", "Bundu", "Silli"] },
      { name: "Dhanbad", bounds: { north: 23.9, south: 23.3, east: 86.7, west: 86.1 }, mandals: ["Dhanbad", "Jharia", "Sindri", "Topchanchi", "Govindpur"] },
      { name: "Jamshedpur (East Singhbhum)", bounds: { north: 22.9, south: 22.3, east: 86.4, west: 85.8 }, mandals: ["Jamshedpur", "Ghatsila", "Baharagora", "Boram", "Dhalbhumgarh"] },
      { name: "Giridih", bounds: { north: 24.3, south: 23.7, east: 86.6, west: 85.9 }, mandals: ["Giridih", "Tisri", "Pirtand", "Bengabad"] },
      { name: "Bokaro", bounds: { north: 23.7, south: 23.1, east: 86.2, west: 85.6 }, mandals: ["Bokaro", "Chas", "Chandankiyari", "Petarbar"] }
    ]
  },
  {
    name: "Karnataka",
    bounds: { north: 18.5, south: 11.6, east: 78.6, west: 74.0 },
    districts: [
      { name: "Bengaluru Urban", bounds: { north: 13.2, south: 12.7, east: 77.8, west: 77.3 }, mandals: ["Bengaluru North", "Bengaluru South", "Bengaluru East", "Anekal", "Devanahalli", "Doddaballapur", "Hosakote", "Nelamangala"] },
      { name: "Mysuru", bounds: { north: 12.5, south: 11.9, east: 76.9, west: 76.3 }, mandals: ["Mysuru", "Mandya", "Hassan", "Hunsur", "T Narasipur", "Periyapatna", "Heggadadevankote", "Nanjangud"] },
      { name: "Hubli-Dharwad", bounds: { north: 15.5, south: 14.9, east: 75.2, west: 74.6 }, mandals: ["Hubli", "Dharwad", "Kalghatgi", "Kundgol", "Navalgund"] },
      { name: "Belagavi", bounds: { north: 16.3, south: 15.6, east: 74.9, west: 74.3 }, mandals: ["Belagavi", "Gokak", "Bailhongal", "Chikodi", "Ramdurg", "Mudhol", "Athani", "Hukkeri"] },
      { name: "Kalaburagi", bounds: { north: 17.6, south: 17.0, east: 76.8, west: 76.2 }, mandals: ["Kalaburagi", "Jevargi", "Chittapur", "Aland", "Afzalpur", "Yadgir", "Shorapur"] },
      { name: "Mangaluru (Dakshina Kannada)", bounds: { north: 13.0, south: 12.4, east: 75.4, west: 74.8 }, mandals: ["Mangaluru", "Sullia", "Bantwal", "Belthangady", "Puttur", "Kadaba"] },
      { name: "Shivamogga", bounds: { north: 14.4, south: 13.8, east: 75.7, west: 75.0 }, mandals: ["Shivamogga", "Sagara", "Bhadravati", "Hosanagara", "Sorab", "Shikaripura", "Tirthahalli", "Sagar"] },
      { name: "Tumakuru", bounds: { north: 13.7, south: 13.1, east: 77.3, west: 76.7 }, mandals: ["Tumakuru", "Tiptur", "Gubbi", "Kunigal", "Madhugiri", "Sira", "Pavagada", "Koratagere"] },
      { name: "Ballari", bounds: { north: 15.5, south: 14.9, east: 76.9, west: 76.3 }, mandals: ["Ballari", "Hospete", "Sandur", "Hagaribommanahalli", "Hadagali", "Siruguppa", "Kudligi"] },
      { name: "Vijayapura", bounds: { north: 17.2, south: 16.6, east: 76.0, west: 75.4 }, mandals: ["Vijayapura", "Muddebihal", "Indi", "Sindagi", "Basavana Bagewadi", "Chadachan"] }
    ]
  },
  {
    name: "Kerala",
    bounds: { north: 12.8, south: 8.2, east: 77.4, west: 74.9 },
    districts: [
      { name: "Thiruvananthapuram", bounds: { north: 8.9, south: 8.3, east: 77.3, west: 76.8 }, mandals: ["Thiruvananthapuram", "Neyyattinkara", "Attingal", "Nedumangad", "Varkala", "Kovalam", "Pothencode"] },
      { name: "Kochi (Ernakulam)", bounds: { north: 10.2, south: 9.8, east: 76.5, west: 76.0 }, mandals: ["Kochi", "Aluva", "Perumbavoor", "Angamaly", "Kothamangalam", "North Paravur", "Piravom", "Muvattupuzha"] },
      { name: "Kozhikode", bounds: { north: 11.6, south: 11.1, east: 76.2, west: 75.6 }, mandals: ["Kozhikode", "Vadakara", "Feroke", "Koyilandy", "Quilandy", "Perambra", "Balussery", "Koduvally"] },
      { name: "Thrissur", bounds: { north: 10.7, south: 10.1, east: 76.5, west: 76.0 }, mandals: ["Thrissur", "Irinjalakuda", "Chalakudy", "Kodungallur", "Guruvayur", "Chavakkad", "Kunnamkulam"] },
      { name: "Palakkad", bounds: { north: 11.1, south: 10.5, east: 76.8, west: 76.3 }, mandals: ["Palakkad", "Ottapalam", "Shoranur", "Mannarkkad", "Pattambi", "Alathur", "Chittur-Thathamangalam"] },
      { name: "Kannur", bounds: { north: 12.2, south: 11.8, east: 75.6, west: 75.1 }, mandals: ["Kannur", "Thalassery", "Mattannur", "Iritty", "Taliparamba", "Payyannur", "Kuthuparamba"] },
      { name: "Malappuram", bounds: { north: 11.4, south: 10.8, east: 76.3, west: 75.8 }, mandals: ["Malappuram", "Tirur", "Perinthalmanna", "Manjeri", "Ponnani", "Tirurrangadi", "Kottakkal"] },
      { name: "Kollam", bounds: { north: 9.3, south: 8.8, east: 77.0, west: 76.5 }, mandals: ["Kollam", "Karunagappally", "Punalur", "Kottarakkara", "Sasthamcotta", "Pathanapuram", "Chathannur"] }
    ]
  },
  {
    name: "Madhya Pradesh",
    bounds: { north: 26.9, south: 21.1, east: 82.8, west: 74.0 },
    districts: [
      { name: "Bhopal", bounds: { north: 23.4, south: 22.8, east: 77.7, west: 77.1 }, mandals: ["Bhopal", "Berasia", "Phanda", "Huzur", "Govindpura"] },
      { name: "Indore", bounds: { north: 22.9, south: 22.4, east: 76.0, west: 75.4 }, mandals: ["Indore", "Mhow", "Sanwer", "Depalpur", "Hatod"] },
      { name: "Jabalpur", bounds: { north: 23.4, south: 22.8, east: 80.1, west: 79.5 }, mandals: ["Jabalpur", "Katni", "Sihora", "Patan", "Bargi"] },
      { name: "Gwalior", bounds: { north: 26.4, south: 25.8, east: 78.4, west: 77.8 }, mandals: ["Gwalior", "Morena", "Sheopur", "Datia", "Bhind"] },
      { name: "Ujjain", bounds: { north: 23.4, south: 22.9, east: 75.9, west: 75.3 }, mandals: ["Ujjain", "Dewas", "Shajapur", "Ratlam", "Mandsaur"] },
      { name: "Sagar", bounds: { north: 24.1, south: 23.5, east: 79.0, west: 78.4 }, mandals: ["Sagar", "Damoh", "Chhatarpur", "Panna", "Tikamgarh"] },
      { name: "Rewa", bounds: { north: 25.0, south: 24.4, east: 81.6, west: 81.0 }, mandals: ["Rewa", "Satna", "Sidhi", "Singrauli", "Shahdol"] },
      { name: "Chhindwara", bounds: { north: 22.5, south: 21.9, east: 78.9, west: 78.3 }, mandals: ["Chhindwara", "Seoni", "Balaghat", "Mandla", "Dindori"] }
    ]
  },
  {
    name: "Maharashtra",
    bounds: { north: 22.1, south: 15.6, east: 80.9, west: 72.6 },
    districts: [
      { name: "Mumbai City", bounds: { north: 19.3, south: 18.9, east: 72.9, west: 72.7 }, mandals: ["Colaba", "Bandra", "Andheri", "Borivali", "Dharavi", "Kurla", "Chembur", "Mulund"] },
      { name: "Mumbai Suburban", bounds: { north: 19.3, south: 18.9, east: 73.0, west: 72.7 }, mandals: ["Thane", "Kalyan", "Dombivli", "Ulhasnagar", "Ambarnath", "Badlapur", "Mira-Bhayandar"] },
      { name: "Pune", bounds: { north: 18.7, south: 18.2, east: 74.1, west: 73.5 }, mandals: ["Pune", "Pimpri-Chinchwad", "Baramati", "Indapur", "Shirur", "Haveli", "Mulshi", "Bhor"] },
      { name: "Nagpur", bounds: { north: 21.3, south: 20.8, east: 79.2, west: 78.7 }, mandals: ["Nagpur", "Kamptee", "Ramtek", "Umred", "Narkhed", "Hingna", "Parseoni", "Bhiwapur"] },
      { name: "Nashik", bounds: { north: 20.5, south: 19.9, east: 74.2, west: 73.6 }, mandals: ["Nashik", "Dindori", "Igatpuri", "Sinnar", "Yeola", "Nandgaon", "Malegaon", "Niphad"] },
      { name: "Aurangabad (Chhatrapati Sambhajinagar)", bounds: { north: 20.2, south: 19.6, east: 75.6, west: 74.9 }, mandals: ["Aurangabad", "Paithan", "Gangapur", "Vaijapur", "Sillod", "Phulambri", "Kannad", "Khuldabad"] },
      { name: "Solapur", bounds: { north: 18.0, south: 17.4, east: 76.0, west: 75.4 }, mandals: ["Solapur", "Pandharpur", "Barshi", "Akkalkot", "Sangola", "Malshiras", "Mangalvedhe", "Mohol"] },
      { name: "Kolhapur", bounds: { north: 16.9, south: 16.3, east: 74.5, west: 73.9 }, mandals: ["Kolhapur", "Ichalkaranji", "Sangli", "Miraj", "Satara", "Karad", "Phaltan", "Wai"] }
    ]
  },
  {
    name: "Manipur",
    bounds: { north: 25.7, south: 23.8, east: 94.8, west: 93.0 },
    districts: [
      { name: "Imphal West", bounds: { north: 24.9, south: 24.3, east: 93.9, west: 93.7 }, mandals: ["Imphal", "Patsoi", "Wangoi", "Heirangoithong", "Sekmai"] },
      { name: "Imphal East", bounds: { north: 25.0, south: 24.4, east: 94.2, west: 93.8 }, mandals: ["Porompat", "Heingang", "Kshetrigao", "Khunou", "Lamlai"] },
      { name: "Thoubal", bounds: { north: 24.7, south: 24.1, east: 94.1, west: 93.7 }, mandals: ["Thoubal", "Wangkhei", "Lilong", "Kakching", "Palel"] },
      { name: "Bishnupur", bounds: { north: 24.7, south: 24.1, east: 93.9, west: 93.4 }, mandals: ["Bishnupur", "Moirang", "Nambol", "Kumbi"] }
    ]
  },
  {
    name: "Meghalaya",
    bounds: { north: 26.1, south: 25.0, east: 92.8, west: 89.8 },
    districts: [
      { name: "East Khasi Hills", bounds: { north: 25.8, south: 25.2, east: 92.1, west: 91.5 }, mandals: ["Shillong", "Cherrapunji (Sohra)", "Mawsynram", "Mawphlang", "Mawkyrwat"] },
      { name: "West Khasi Hills", bounds: { north: 25.8, south: 25.0, east: 91.5, west: 90.2 }, mandals: ["Nongstoin", "Mairang", "Ranikor"] },
      { name: "Ri Bhoi", bounds: { north: 26.1, south: 25.5, east: 92.4, west: 91.8 }, mandals: ["Nongpoh", "Umling", "Jirang", "Umsning"] },
      { name: "Jaintia Hills (East Jaintia)", bounds: { north: 25.5, south: 25.0, east: 92.8, west: 92.1 }, mandals: ["Jowai", "Laskein", "Amlarem"] },
      { name: "West Jaintia Hills", bounds: { north: 25.5, south: 25.0, east: 92.4, west: 92.0 }, mandals: ["Khliehriat", "Thadlaskein"] }
    ]
  },
  {
    name: "Mizoram",
    bounds: { north: 24.5, south: 21.9, east: 93.4, west: 92.2 },
    districts: [
      { name: "Aizawl", bounds: { north: 24.0, south: 23.4, east: 93.0, west: 92.5 }, mandals: ["Aizawl", "Durtlang", "Sihphir", "Lungei", "Khawzawl"] },
      { name: "Lunglei", bounds: { north: 23.1, south: 22.5, east: 93.0, west: 92.4 }, mandals: ["Lunglei", "Tlabung", "Lawngtlai", "Hnahthial"] }
    ]
  },
  {
    name: "Nagaland",
    bounds: { north: 26.7, south: 25.2, east: 95.3, west: 93.3 },
    districts: [
      { name: "Kohima", bounds: { north: 25.8, south: 25.5, east: 94.2, west: 93.8 }, mandals: ["Kohima", "Zubza", "Kigwema", "Viswema"] },
      { name: "Dimapur", bounds: { north: 26.0, south: 25.6, east: 93.8, west: 93.3 }, mandals: ["Dimapur", "Chumukedima", "Niuland", "Kuhuboto"] },
      { name: "Mokokchung", bounds: { north: 26.5, south: 26.0, east: 94.5, west: 94.0 }, mandals: ["Mokokchung", "Longtrok", "Tuli", "Mangkolemba"] }
    ]
  },
  {
    name: "Odisha",
    bounds: { north: 22.6, south: 17.8, east: 87.5, west: 81.4 },
    districts: [
      { name: "Bhubaneswar (Khordha)", bounds: { north: 20.5, south: 19.9, east: 85.9, west: 85.3 }, mandals: ["Bhubaneswar", "Balianta", "Balipatna", "Jatani", "Khordha", "Banapur", "Bolagarh", "Tangi"] },
      { name: "Cuttack", bounds: { north: 20.8, south: 20.2, east: 86.2, west: 85.6 }, mandals: ["Cuttack", "Banki", "Kendrapara", "Jagatpur", "Choudwar", "Salepur", "Nischintakoili"] },
      { name: "Berhampur (Ganjam)", bounds: { north: 19.6, south: 18.9, east: 85.1, west: 84.3 }, mandals: ["Berhampur", "Chhatrapur", "Hinjili", "Khalikote", "Digapahandi", "Aska", "Bhanjanagar", "Phulbani"] },
      { name: "Sambalpur", bounds: { north: 21.6, south: 20.9, east: 84.1, west: 83.4 }, mandals: ["Sambalpur", "Burla", "Hirakud", "Jharsuguda", "Rourkela (Sundergarh)"] },
      { name: "Balasore", bounds: { north: 21.7, south: 21.1, east: 87.2, west: 86.5 }, mandals: ["Balasore", "Bhadrak", "Jajpur", "Chandipur", "Nilgiri"] }
    ]
  },
  {
    name: "Punjab",
    bounds: { north: 32.5, south: 29.6, east: 76.9, west: 73.9 },
    districts: [
      { name: "Amritsar", bounds: { north: 31.9, south: 31.4, east: 74.9, west: 74.4 }, mandals: ["Amritsar", "Tarn Taran", "Ajnala", "Majitha", "Baba Bakala", "Jandiala Guru"] },
      { name: "Ludhiana", bounds: { north: 31.0, south: 30.5, east: 75.9, west: 75.4 }, mandals: ["Ludhiana", "Samrala", "Khanna", "Raikot", "Jagraon", "Machhiwara", "Sidhwan Bet", "Sahnewal"] },
      { name: "Jalandhar", bounds: { north: 31.5, south: 31.0, east: 75.7, west: 75.2 }, mandals: ["Jalandhar", "Nakodar", "Phagwara", "Nawanshahr", "Kapurthala", "Phillaur", "Shahkot"] },
      { name: "Chandigarh (Punjab side)", bounds: { north: 30.8, south: 30.6, east: 76.9, west: 76.6 }, mandals: ["Chandigarh", "Mohali", "Panchkula", "Derabassi", "Zirakpur"] },
      { name: "Patiala", bounds: { north: 30.5, south: 30.0, east: 76.7, west: 76.2 }, mandals: ["Patiala", "Rajpura", "Fategarh Sahib", "Samana", "Patran"] },
      { name: "Bathinda", bounds: { north: 30.4, south: 29.8, east: 75.1, west: 74.6 }, mandals: ["Bathinda", "Mansa", "Muktsar", "Fazilka", "Ferozepur", "Firozpur"] }
    ]
  },
  {
    name: "Rajasthan",
    bounds: { north: 30.3, south: 23.1, east: 78.3, west: 69.5 },
    districts: [
      { name: "Jaipur", bounds: { north: 27.2, south: 26.6, east: 76.0, west: 75.4 }, mandals: ["Jaipur", "Amber", "Sanganer", "Chaksu", "Phulera", "Dudu", "Amer", "Bassi", "Chomu", "Kotputli"] },
      { name: "Jodhpur", bounds: { north: 26.7, south: 26.1, east: 73.2, west: 72.7 }, mandals: ["Jodhpur", "Phalodi", "Osian", "Bilara", "Lohawat", "Mandore", "Shergarh", "Balesar"] },
      { name: "Udaipur", bounds: { north: 24.8, south: 24.3, east: 73.9, west: 73.4 }, mandals: ["Udaipur", "Nathdwara", "Rajsamand", "Chittorgarh", "Bhilwara", "Dungarpur", "Banswara", "Semari"] },
      { name: "Ajmer", bounds: { north: 26.7, south: 26.1, east: 75.0, west: 74.4 }, mandals: ["Ajmer", "Pushkar", "Kishangarh", "Nasirabad", "Kekri", "Beawar", "Sarwar", "Bhinay"] },
      { name: "Kota", bounds: { north: 25.4, south: 24.7, east: 76.2, west: 75.7 }, mandals: ["Kota", "Bundi", "Baran", "Jhalawar", "Sangod", "Anta", "Sultanpur", "Pipalda"] },
      { name: "Bikaner", bounds: { north: 29.0, south: 27.8, east: 74.0, west: 72.8 }, mandals: ["Bikaner", "Nokha", "Kolayat", "Lunkaransar", "Pugal", "Khajuwala"] },
      { name: "Alwar", bounds: { north: 28.1, south: 27.5, east: 77.0, west: 76.3 }, mandals: ["Alwar", "Behror", "Tijara", "Rajgarh", "Laxmangarh", "Mundawar", "Ramgarh", "Bansur"] }
    ]
  },
  {
    name: "Sikkim",
    bounds: { north: 28.1, south: 27.1, east: 88.9, west: 88.0 },
    districts: [
      { name: "East Sikkim", bounds: { north: 27.8, south: 27.2, east: 88.9, west: 88.3 }, mandals: ["Gangtok", "Pakyong", "Rongli", "Rhenock", "Rumtek"] },
      { name: "North Sikkim", bounds: { north: 28.1, south: 27.7, east: 88.5, west: 88.0 }, mandals: ["Mangan", "Chungthang", "Lachung", "Lachen"] },
      { name: "South Sikkim", bounds: { north: 27.5, south: 27.1, east: 88.6, west: 88.1 }, mandals: ["Namchi", "Ravangla", "Jorethang", "Yangang"] },
      { name: "West Sikkim", bounds: { north: 27.5, south: 27.1, east: 88.3, west: 88.0 }, mandals: ["Gyalshing", "Pelling", "Yuksom", "Soreng"] }
    ]
  },
  {
    name: "Tamil Nadu",
    bounds: { north: 13.6, south: 8.1, east: 80.4, west: 76.2 },
    districts: [
      { name: "Chennai", bounds: { north: 13.3, south: 12.9, east: 80.3, west: 80.1 }, mandals: ["Chennai", "Ambattur", "Avadi", "Sholinganallur", "Tambaram", "Chrompet", "Velachery", "Adyar", "T Nagar", "Perambur"] },
      { name: "Coimbatore", bounds: { north: 11.3, south: 10.8, east: 77.2, west: 76.7 }, mandals: ["Coimbatore", "Tirupur", "Pollachi", "Mettupalayam", "Gudimangalam", "Sultanpet", "Anamalai", "Thondamuthur"] },
      { name: "Madurai", bounds: { north: 10.1, south: 9.6, east: 78.2, west: 77.7 }, mandals: ["Madurai", "Dindigul", "Theni", "Sivaganga", "Ramanathapuram", "Melur", "Thirumangalam", "Tirumohur"] },
      { name: "Salem", bounds: { north: 11.8, south: 11.3, east: 78.3, west: 77.8 }, mandals: ["Salem", "Namakkal", "Dharmapuri", "Krishnagiri", "Omalur", "Attur", "Yercaud", "Edappadi"] },
      { name: "Tiruchirappalli", bounds: { north: 10.9, south: 10.4, east: 78.9, west: 78.4 }, mandals: ["Tiruchirappalli", "Perambalur", "Ariyalur", "Thanjavur", "Tiruvarur", "Lalgudi", "Srirangam", "Manapparai"] },
      { name: "Tirunelveli", bounds: { north: 9.0, south: 8.2, east: 77.9, west: 77.4 }, mandals: ["Tirunelveli", "Tuticorin", "Nagercoil (Kanyakumari)", "Tenkasi", "Sankarankovil", "Radhapuram", "Palayamkottai", "Ambasamudram"] },
      { name: "Vellore", bounds: { north: 13.0, south: 12.5, east: 79.4, west: 78.8 }, mandals: ["Vellore", "Ranipet", "Tirupattur", "Tiruvannamalai", "Ambur", "Arani", "Wandiwash", "Gudiyatham"] }
    ]
  },
  {
    name: "Telangana",
    bounds: { north: 19.9, south: 15.8, east: 81.3, west: 77.2 },
    districts: [
      { name: "Hyderabad", bounds: { north: 17.6, south: 17.2, east: 78.7, west: 78.3 }, mandals: ["Secunderabad", "Ameerpet", "Begumpet", "Banjara Hills", "Jubilee Hills", "Abids", "Charminar", "Bahadurpura", "Golconda", "Musheerabad", "Malakpet", "Uppal", "LB Nagar", "Hayathnagar", "Rajendranagar", "Mehdipatnam", "Khairatabad", "Nampally", "Saidabad", "Amberpet"] },
      { name: "Rangareddy", bounds: { north: 17.7, south: 16.9, east: 78.7, west: 77.9 }, mandals: ["Shadnagar", "Maheshwaram", "Kandukur", "Ibrahimpatnam", "Marpalle", "Chevella", "Vikarabad", "Kothur", "Tandur", "Parigi", "Yacharam", "Amangal", "Farooqnagar", "Pudur", "Doma", "Shabad", "Basheerabad", "Balapur", "Meerkhanpet", "Hayathnagar"] },
      { name: "Medchal-Malkajgiri", bounds: { north: 17.8, south: 17.3, east: 78.7, west: 78.3 }, mandals: ["Medchal", "Malkajgiri", "Ghatkesar", "Keesara", "Kompally", "Quthbullapur", "Balanagar", "Dundigal", "Ameenpur", "Mulugu", "Shameerpet", "Medipally", "Bachupally", "Suraram", "Alwal"] },
      { name: "Sangareddy", bounds: { north: 17.9, south: 17.3, east: 78.3, west: 77.5 }, mandals: ["Sangareddy", "Zaheerabad", "Patancheru", "Kandi", "Ramachandrapuram", "Narayankhed", "Andole", "Nyalkal", "Manur", "Pulkal", "Jinnaram", "Sadasivpet", "Kohir", "Ameenpur", "Hathnoora", "Vatpally", "Raikode", "Mominpet", "Jogipet", "Doulatabad"] },
      { name: "Siddipet", bounds: { north: 18.3, south: 17.7, east: 79.0, west: 78.1 }, mandals: ["Siddipet", "Gajwel", "Dubbak", "Thoguta", "Koheda", "Cheriyal", "Medak", "Narsapur", "Toopran", "Narayankhed", "Yeldurthy", "Wargal", "Nangnoor", "Mulugu", "Mirdoddi", "Akkannapet", "Husnabad", "Yellareddy", "Raipole", "Doulthabad"] },
      { name: "Medak", bounds: { north: 18.1, south: 17.5, east: 78.4, west: 77.8 }, mandals: ["Medak", "Toopran", "Papannapet", "Shankarampet", "Narsapur", "Ramayampet", "Alladurg", "Regode", "Chegunta", "Yeldurthy", "Kulcharam", "Tekmal", "Masaipet"] },
      { name: "Nizamabad", bounds: { north: 18.8, south: 18.1, east: 78.3, west: 77.8 }, mandals: ["Nizamabad", "Armoor", "Bodhan", "Kamareddy", "Yellareddy", "Banswada", "Bhiknoor", "Velpoor", "Yedapalli", "Dichpally", "Mortad", "Varni", "Bheemgal", "Jakranpally", "Nandipet", "Navipet", "Pitlam", "Tadwai", "Kotagiri", "Nizamsagar", "Birkoor"] },
      { name: "Kamareddy", bounds: { north: 18.4, south: 17.9, east: 78.3, west: 77.7 }, mandals: ["Kamareddy", "Banswada", "Yellareddy", "Bhiknoor", "Bheemgal", "Pitlam", "Sadashivanagar", "Madnur", "Rajampet", "Tadwai", "Lingampet", "Ramsampalli", "Machareddy", "Domakonda", "Saakini", "Nagireddypet", "Jukkal", "Pedda Kodapgal", "Makloor"] },
      { name: "Karimnagar", bounds: { north: 18.6, south: 18.0, east: 79.5, west: 78.9 }, mandals: ["Karimnagar", "Peddapalli", "Ramagundam", "Sultanabad", "Jagtial", "Choppadandi", "Kothapalli", "Gambhiraopet", "Ramadugu", "Gangadhara", "Huzurabad", "Husnabad", "Veenavanka", "Mallial", "Chigurumamidi", "Manthani"] },
      { name: "Peddapalli", bounds: { north: 18.8, south: 18.2, east: 79.7, west: 79.0 }, mandals: ["Peddapalli", "Ramagundam", "Manthani", "Sultanabad", "Dharmaram", "Kannaiah Gudem", "Julapalli", "Odela", "Eligedu", "Srirampur", "Ramakistapuram", "Anthargaon", "Kothapalli", "Medipalli"] },
      { name: "Jagtial", bounds: { north: 18.9, south: 18.3, east: 79.1, west: 78.5 }, mandals: ["Jagtial", "Metpalle", "Raikal", "Dharmapuri", "Sarangapur", "Velgatoor", "Govindapur", "Kodimyal", "Pegadapalle", "Beerpur", "Buggaram", "Korutla", "Mallial", "Kathlapur", "Mella Cheruvu"] },
      { name: "Rajanna Sircilla", bounds: { north: 18.5, south: 18.0, east: 78.9, west: 78.3 }, mandals: ["Sircilla", "Vemulawada", "Thangallapally", "Yellareddypet", "Gambhiraopet", "Boinpalle", "Konaraopet", "Cheriyal", "Manthani", "Elkaturthi", "Mustabad", "Rudrangi"] },
      { name: "Nirmal", bounds: { north: 19.3, south: 18.7, east: 78.5, west: 77.8 }, mandals: ["Nirmal", "Bhainsa", "Luxettipet", "Kuntala", "Mamada", "Dichpally", "Khanapur", "Mudhole", "Kubeer", "Tanur", "Dilawarpur", "Bheempur", "Sarangapur", "Khanapur", "Narsapur", "Laxmanchanda", "Lokeswaram"] },
      { name: "Adilabad", bounds: { north: 19.8, south: 19.1, east: 78.7, west: 77.9 }, mandals: ["Adilabad", "Mancherial", "Nirmal", "Utnoor", "Asifabad", "Sirpur", "Ichoda", "Bhimpur", "Talamadugu", "Jainath", "Tamsi", "Bazarhatnoor", "Bheempur", "Mankeshwar", "Narnoor", "Gudihatnoor", "Kotapalli", "Neradigonda"] },
      { name: "Mancherial", bounds: { north: 19.2, south: 18.6, east: 79.5, west: 79.0 }, mandals: ["Mancherial", "Belampalli", "Luxettipet", "Chennur", "Jannaram", "Bheemini", "Hajipur", "Kasipet", "Kotapalli", "Dandepalli", "Kannepalli", "Wankidi", "Ramakrishnapur", "Mandamarri"] },
      { name: "Kumuram Bheem Asifabad", bounds: { north: 19.6, south: 19.1, east: 80.0, west: 79.4 }, mandals: ["Asifabad", "Kagaznagar", "Jainath", "Wankidi", "Rebbena", "Sirpur", "Tiryani", "Penchikalapeta", "Kerameri", "Narnoor", "Dahegaon", "Bejjur"] },
      { name: "Warangal Urban", bounds: { north: 18.1, south: 17.7, east: 80.0, west: 79.6 }, mandals: ["Warangal", "Hanamkonda", "Kazipet", "Parkal", "Bheemadevarapalli", "Shayampet", "Inavolu"] },
      { name: "Warangal Rural", bounds: { north: 18.3, south: 17.7, east: 79.9, west: 79.3 }, mandals: ["Narsampet", "Dornakal", "Atmakur", "Geesugonda", "Duggondi", "Khanapur", "Sangem", "Mahbubabad", "Regonda", "Thorrur", "Wardhannapeta", "Parvathagiri"] },
      { name: "Mahbubabad", bounds: { north: 17.9, south: 17.3, east: 80.3, west: 79.8 }, mandals: ["Mahbubabad", "Dornakal", "Thorrur", "Bayyaram", "Maripeda", "Nellipaka", "Kuravi", "Nellikudur", "Gudur", "Chinnagudur", "Nathnaipally", "Kesamudram"] },
      { name: "Jangaon", bounds: { north: 17.9, south: 17.4, east: 79.5, west: 79.0 }, mandals: ["Jangaon", "Raghunathpally", "Ghanpur", "Bachannapeta", "Kodakandla", "Station Ghanpur", "Devaruppula", "Lingalaghanpur", "Narmetta", "Tharigoppula", "Zaffargadh", "Chilpur"] },
      { name: "Hanamkonda", bounds: { north: 18.1, south: 17.7, east: 79.7, west: 79.3 }, mandals: ["Hanamkonda", "Warangal", "Bheemdevarapalli", "Shayampet", "Dharmasagar"] },
      { name: "Bhadradri Kothagudem", bounds: { north: 18.1, south: 17.1, east: 80.9, west: 80.1 }, mandals: ["Kothagudem", "Bhadrachalam", "Palvancha", "Yellandu", "Manuguru", "Aswaraopeta", "Laxmidevipalle", "Chandrugonda", "Tekulapally", "Dammapeta", "Burgampahad", "Sujathanagar", "Bayyaram", "Cherla", "Gundala"] },
      { name: "Khammam", bounds: { north: 17.6, south: 16.8, east: 80.4, west: 79.9 }, mandals: ["Khammam", "Kothagudem", "Wyra", "Madhira", "Kallur", "Nelakondapally", "Thirumalayapalem", "Sathupally", "Vemsoor", "Enkoor", "Raghunadhapalem", "Mudigonda", "Penuballi", "Julurpad", "Chintakani"] },
      { name: "Suryapet", bounds: { north: 17.4, south: 16.8, east: 79.8, west: 79.1 }, mandals: ["Suryapet", "Nalgonda", "Miryalaguda", "Kodad", "Huzurnagar", "Mothkur", "Nidamanur", "Chivvemla", "Munugode", "Garidepally", "Mellacheruvu", "Atmakur", "Nadigudem", "Penpahad", "Aroor"] },
      { name: "Nalgonda", bounds: { north: 17.2, south: 16.6, east: 79.4, west: 78.8 }, mandals: ["Nalgonda", "Miryalaguda", "Bhongir", "Pochampally", "Devarakonda", "Nakrekal", "Thungathurthy", "Narayanpur", "Chandur", "Ramannapeta", "Marriguda", "Tirumalagiri", "Yadagirigutta", "Chityal", "Kangal", "Haliya", "Peddavoora", "Anumula"] },
      { name: "Yadadri Bhuvanagiri", bounds: { north: 17.4, south: 16.8, east: 79.2, west: 78.6 }, mandals: ["Bhongir", "Yadagirigutta", "Choutuppal", "Mothkur", "Thurlapally", "Bommalaramaram", "Raigiri", "Bibinagar", "Alair", "Pochampally", "Chandampet", "Marriguda", "Tukkuguda"] },
      { name: "Wanaparthy", bounds: { north: 16.6, south: 15.9, east: 78.6, west: 77.8 }, mandals: ["Wanaparthy", "Gadwal", "Atmakur", "Peddamandadi", "Gopalpet", "Pangal", "Maddur", "Ghanpur", "Srirangapur", "Pebbair", "Kothakota", "Amarchintha", "Revally"] },
      { name: "Nagarkurnool", bounds: { north: 16.7, south: 16.1, east: 78.5, west: 77.8 }, mandals: ["Nagarkurnool", "Achampet", "Kollapur", "Narketpally", "Kalwakurthi", "Bijinapalle", "Tadoor", "Maddur", "Lingal", "Uppununthala", "Veldanda", "Dhanwada", "Peddakothapalle", "Amrabad", "Telkapalle"] },
      { name: "Jogulamba Gadwal", bounds: { north: 16.3, south: 15.7, east: 77.9, west: 77.3 }, mandals: ["Gadwal", "Alampur", "Maldakal", "Dharur", "Gattu", "Ieeja", "Ghattu", "Dodded", "Waddepalle"] },
      { name: "Mahabubnagar", bounds: { north: 16.9, south: 16.1, east: 78.3, west: 77.5 }, mandals: ["Mahabubnagar", "Jadcherla", "Narayanpet", "Achampet", "Shadnagar", "Kalwakurthi", "Devarkadra", "Bhoothpur", "Kothur", "Dhanwada", "Addakal", "Nawabpet", "Koilkonda", "Balanagar", "Maddur"] },
      { name: "Vikarabad", bounds: { north: 17.5, south: 17.0, east: 77.9, west: 77.3 }, mandals: ["Vikarabad", "Tandur", "Parigi", "Marpalle", "Basheerabad", "Chevella", "Pudur", "Shabad", "Doma", "Bantwaram", "Dharur", "Kotapally", "Kulkacherla", "Nawabpet", "Yalal"] },
      { name: "Narayanpet", bounds: { north: 16.9, south: 16.3, east: 77.7, west: 77.0 }, mandals: ["Narayanpet", "Makthal", "Utkoor", "Damaragidda", "Narva", "Kothakota", "Maganoor", "Kosgi", "Bijnapalle", "Marikal"] }
    ]
  },
  {
    name: "Tripura",
    bounds: { north: 24.5, south: 22.9, east: 92.4, west: 91.2 },
    districts: [
      { name: "West Tripura", bounds: { north: 24.2, south: 23.5, east: 91.9, west: 91.2 }, mandals: ["Agartala", "Jirania", "Majlishpur", "Dukli", "Mohanpur", "Hezamara", "Lefunga"] },
      { name: "North Tripura", bounds: { north: 24.5, south: 24.0, east: 92.3, west: 91.8 }, mandals: ["Dharmanagar", "Kumarghat", "Kanchanpur"] },
      { name: "South Tripura", bounds: { north: 23.4, south: 22.9, east: 92.3, west: 91.8 }, mandals: ["Sabroom", "Belonia", "Udaipur", "Rajnagar"] },
      { name: "Gomati", bounds: { north: 23.8, south: 23.3, east: 92.2, west: 91.7 }, mandals: ["Udaipur", "Amarpur", "Karbook", "Ompi"] }
    ]
  },
  {
    name: "Uttar Pradesh",
    bounds: { north: 30.4, south: 23.9, east: 84.6, west: 77.1 },
    districts: [
      { name: "Lucknow", bounds: { north: 27.1, south: 26.5, east: 81.2, west: 80.6 }, mandals: ["Lucknow", "Bakshi Ka Talab", "Malihabad", "Mohanlalganj", "Sarojini Nagar", "Kakori", "Chinhat", "Gosainganj"] },
      { name: "Agra", bounds: { north: 27.4, south: 26.8, east: 78.2, west: 77.6 }, mandals: ["Agra", "Firozabad", "Mainpuri", "Mathura", "Etah", "Fatehabad", "Kheragarh", "Etmadpur"] },
      { name: "Varanasi", bounds: { north: 25.5, south: 24.9, east: 83.2, west: 82.6 }, mandals: ["Varanasi", "Bhadohi", "Jaunpur", "Mirzapur", "Chandauli", "Araziline", "Kashi Vidyapeeth", "Pindra"] },
      { name: "Kanpur", bounds: { north: 26.7, south: 26.2, east: 80.6, west: 80.0 }, mandals: ["Kanpur", "Unnao", "Fatehpur", "Kannauj", "Bilhaur", "Ghatampur", "Kalyanpur", "Shivrajpur"] },
      { name: "Meerut", bounds: { north: 29.2, south: 28.7, east: 77.9, west: 77.4 }, mandals: ["Meerut", "Ghaziabad", "Hapur", "Bulandshahr", "Baghpat", "Modipuram", "Sardhana", "Mawana"] },
      { name: "Allahabad (Prayagraj)", bounds: { north: 25.8, south: 25.2, east: 82.0, west: 81.4 }, mandals: ["Prayagraj", "Kaushambi", "Fatehpur", "Bara", "Handia", "Soraon", "Phulpur", "Meja"] },
      { name: "Gorakhpur", bounds: { north: 26.9, south: 26.4, east: 83.7, west: 83.1 }, mandals: ["Gorakhpur", "Deoria", "Kushinagar", "Maharajganj", "Bantpar", "Chauri Chaura", "Gola"] },
      { name: "Mathura", bounds: { north: 27.7, south: 27.1, east: 77.8, west: 77.2 }, mandals: ["Mathura", "Vrindavan", "Goverdhan", "Baldeo", "Mant", "Chhata", "Kosi Kalan"] },
      { name: "Bareilly", bounds: { north: 28.5, south: 28.0, east: 79.5, west: 78.9 }, mandals: ["Bareilly", "Pilibhit", "Rampur", "Shahjahanpur", "Baheri", "Aonla", "Meerganj", "Nawabganj"] },
      { name: "Ghaziabad", bounds: { north: 28.8, south: 28.3, east: 77.7, west: 77.1 }, mandals: ["Ghaziabad", "Hapur", "Greater Noida", "Loni", "Modinagar", "Muradnagar", "Sahibabad"] }
    ]
  },
  {
    name: "Uttarakhand",
    bounds: { north: 31.5, south: 28.7, east: 81.1, west: 77.6 },
    districts: [
      { name: "Dehradun", bounds: { north: 31.0, south: 30.0, east: 78.5, west: 77.7 }, mandals: ["Dehradun", "Rishikesh", "Doiwala", "Sahaspur", "Vikasnagar", "Chakrata", "Mussoorie", "Hardwar (adjacent)"] },
      { name: "Haridwar", bounds: { north: 30.0, south: 29.5, east: 78.4, west: 78.0 }, mandals: ["Haridwar", "Roorkee", "Laksar", "Manglaur", "Bhagwanpur", "Narsan"] },
      { name: "Pauri Garhwal", bounds: { north: 30.3, south: 29.7, east: 79.0, west: 78.5 }, mandals: ["Pauri", "Kotdwar", "Srinagar", "Lansdowne", "Dhumakot", "Jamnikhal"] },
      { name: "Nainital", bounds: { north: 29.6, south: 29.1, east: 79.5, west: 79.0 }, mandals: ["Nainital", "Haldwani", "Ramnagar", "Kaladhungi", "Bhimtal", "Lalkuan", "Dhari"] },
      { name: "Almora", bounds: { north: 29.8, south: 29.3, east: 80.0, west: 79.5 }, mandals: ["Almora", "Ranikhet", "Bageshwar", "Someshwar", "Binta", "Hawalbagh", "Dwarhat"] },
      { name: "Pithoragarh", bounds: { north: 30.1, south: 29.5, east: 81.1, west: 80.3 }, mandals: ["Pithoragarh", "Munsyari", "Didihat", "Gangolihat", "Berinag", "Dharchula"] }
    ]
  },
  {
    name: "West Bengal",
    bounds: { north: 27.2, south: 21.5, east: 89.9, west: 85.8 },
    districts: [
      { name: "Kolkata", bounds: { north: 22.7, south: 22.4, east: 88.5, west: 88.2 }, mandals: ["Kolkata", "Howrah", "Salt Lake", "Dum Dum", "Barasat", "Barrackpur", "North 24 Parganas", "South 24 Parganas"] },
      { name: "Darjeeling", bounds: { north: 27.2, south: 26.5, east: 88.6, west: 87.9 }, mandals: ["Darjeeling", "Siliguri", "Kurseong", "Mirik", "Kalimpong", "Jalpaiguri", "Alipurduar", "Cooch Behar"] },
      { name: "Bardhaman", bounds: { north: 23.5, south: 22.9, east: 88.1, west: 87.3 }, mandals: ["Bardhaman", "Durgapur", "Asansol", "Kulti", "Raniganj", "Kalna", "Katwa", "Memari"] },
      { name: "Midnapore", bounds: { north: 22.5, south: 21.5, east: 87.5, west: 86.8 }, mandals: ["Midnapore (Paschim)", "Medinipur (Purba)", "Jhargram", "Kharagpur", "Haldia", "Tamluk", "Contai", "Egra"] },
      { name: "Murshidabad", bounds: { north: 24.5, south: 23.7, east: 88.5, west: 87.9 }, mandals: ["Murshidabad", "Berhampore", "Azimganj", "Lalbagh", "Jiaganj", "Salar", "Islampur"] },
      { name: "Nadia", bounds: { north: 23.7, south: 23.0, east: 88.9, west: 88.3 }, mandals: ["Krishnanagar", "Ranaghat", "Chakdaha", "Santipur", "Kalyani", "Nabadwip", "Shantipur"] }
    ]
  },
  {
    name: "Andaman and Nicobar Islands",
    bounds: { north: 13.7, south: 6.8, east: 93.9, west: 92.2 },
    districts: [
      { name: "North and Middle Andaman", bounds: { north: 13.7, south: 11.5, east: 93.1, west: 92.6 }, mandals: ["Mayabunder", "Diglipur", "Rangat", "Billiground"] },
      { name: "South Andaman", bounds: { north: 11.8, south: 10.5, east: 92.9, west: 92.5 }, mandals: ["Port Blair", "Ferrargunj", "Bambooflat"] },
      { name: "Nicobar", bounds: { north: 9.2, south: 6.8, east: 93.9, west: 92.6 }, mandals: ["Car Nicobar", "Nancowry", "Great Nicobar"] }
    ]
  },
  {
    name: "Chandigarh",
    bounds: { north: 30.8, south: 30.6, east: 76.9, west: 76.7 },
    districts: [
      { name: "Chandigarh", bounds: { north: 30.8, south: 30.6, east: 76.9, west: 76.7 }, mandals: ["Sector 1-17", "Sector 18-35", "Sector 36-56", "Industrial Area", "Manimajra", "Bapu Dham Colony", "Daria", "Dhanas"] }
    ]
  },
  {
    name: "Dadra and Nagar Haveli and Daman and Diu",
    bounds: { north: 22.4, south: 20.1, east: 73.3, west: 72.6 },
    districts: [
      { name: "Dadra and Nagar Haveli", bounds: { north: 20.6, south: 20.1, east: 73.1, west: 72.8 }, mandals: ["Silvassa", "Naroli", "Khanvel", "Dadra"] },
      { name: "Daman", bounds: { north: 20.5, south: 20.3, east: 72.9, west: 72.8 }, mandals: ["Daman", "Nani Daman", "Moti Daman"] },
      { name: "Diu", bounds: { north: 20.8, south: 20.6, east: 71.0, west: 70.8 }, mandals: ["Diu", "Fudam", "Vanakbara"] }
    ]
  },
  {
    name: "Delhi",
    bounds: { north: 28.9, south: 28.4, east: 77.4, west: 76.8 },
    districts: [
      { name: "North Delhi", bounds: { north: 28.8, south: 28.6, east: 77.3, west: 77.1 }, mandals: ["Civil Lines", "Rohini", "Alipur", "Narela", "Samaypur Badli", "Kotwali", "Model Town"] },
      { name: "South Delhi", bounds: { north: 28.6, south: 28.4, east: 77.3, west: 77.1 }, mandals: ["Saket", "Vasant Kunj", "Hauz Khas", "Mehrauli", "Kalkaji", "Tughlakabad", "Deoli"] },
      { name: "East Delhi", bounds: { north: 28.7, south: 28.5, east: 77.4, west: 77.2 }, mandals: ["Preet Vihar", "Laxmi Nagar", "Shahdara", "Vivek Vihar", "Mandoli", "Patparganj"] },
      { name: "West Delhi", bounds: { north: 28.7, south: 28.5, east: 77.2, west: 77.0 }, mandals: ["Janakpuri", "Dwarka", "Palam", "Uttam Nagar", "Vikaspuri", "Tilak Nagar"] },
      { name: "Central Delhi", bounds: { north: 28.7, south: 28.6, east: 77.3, west: 77.1 }, mandals: ["Connaught Place", "Karol Bagh", "Paharganj", "Sadar Bazar", "Rajinder Nagar"] },
      { name: "New Delhi", bounds: { north: 28.7, south: 28.5, east: 77.3, west: 77.1 }, mandals: ["New Delhi", "Chanakyapuri", "Moti Bagh", "Sarojini Nagar", "Vasant Vihar"] },
      { name: "North East Delhi", bounds: { north: 28.8, south: 28.6, east: 77.4, west: 77.2 }, mandals: ["Seelampur", "Jaffrabad", "Mustafabad", "Gokulpur", "Bhajanpura"] },
      { name: "South East Delhi", bounds: { north: 28.6, south: 28.4, east: 77.3, west: 77.1 }, mandals: ["Badarpur", "Sangam Vihar", "Ambedkar Nagar", "Okhla"] },
      { name: "South West Delhi", bounds: { north: 28.6, south: 28.4, east: 77.2, west: 77.0 }, mandals: ["Dwarka Sector", "Kapashera", "Bijwasan", "Palam Village"] },
      { name: "Shahdara", bounds: { north: 28.7, south: 28.5, east: 77.4, west: 77.2 }, mandals: ["Shahdara", "Seemapuri", "Kondli", "Gandhi Nagar", "Vishwas Nagar", "Geeta Colony"] },
      { name: "North West Delhi", bounds: { north: 28.8, south: 28.6, east: 77.2, west: 77.0 }, mandals: ["Rohini", "Pitampura", "Shalimar Bagh", "Wazirpur", "Kanjhawala"] }
    ]
  },
  {
    name: "Jammu and Kashmir",
    bounds: { north: 37.1, south: 32.3, east: 80.5, west: 73.9 },
    districts: [
      { name: "Srinagar", bounds: { north: 34.4, south: 33.9, east: 74.9, west: 74.5 }, mandals: ["Srinagar", "Ganderbal", "Budgam", "Beerwah", "Chadoora", "Khag"] },
      { name: "Jammu", bounds: { north: 32.9, south: 32.4, east: 75.0, west: 74.5 }, mandals: ["Jammu", "Udhampur", "Reasi", "Rajouri", "Poonch", "Nowshera", "Samba", "Kathua"] },
      { name: "Anantnag", bounds: { north: 34.0, south: 33.4, east: 75.3, west: 74.7 }, mandals: ["Anantnag", "Kulgam", "Shopian", "Pulwama", "Tral", "Pahalgam"] },
      { name: "Baramulla", bounds: { north: 34.6, south: 34.0, east: 74.7, west: 74.1 }, mandals: ["Baramulla", "Sopore", "Kupwara", "Handwara", "Pattan", "Uri", "Tangmarg"] },
      { name: "Leh", bounds: { north: 36.5, south: 33.5, east: 79.3, west: 75.9 }, mandals: ["Leh", "Nubra", "Khaltsi", "Durbuk", "Nyoma"] }
    ]
  },
  {
    name: "Ladakh",
    bounds: { north: 36.2, south: 32.2, east: 79.5, west: 75.4 },
    districts: [
      { name: "Leh", bounds: { north: 36.2, south: 33.1, east: 79.5, west: 76.3 }, mandals: ["Leh", "Nubra", "Khaltsi", "Durbuk", "Nyoma", "Diskit"] },
      { name: "Kargil", bounds: { north: 35.1, south: 33.5, east: 77.4, west: 75.4 }, mandals: ["Kargil", "Zanskar", "Drass", "Shakar Chiktan"] }
    ]
  },
  {
    name: "Lakshadweep",
    bounds: { north: 12.3, south: 8.3, east: 74.0, west: 72.1 },
    districts: [
      { name: "Lakshadweep", bounds: { north: 12.3, south: 8.3, east: 74.0, west: 72.1 }, mandals: ["Kavaratti", "Agatti", "Amini", "Andrott", "Minicoy", "Kalpeni", "Kadmat", "Kiltan"] }
    ]
  },
  {
    name: "Puducherry",
    bounds: { north: 12.1, south: 10.6, east: 80.3, west: 79.6 },
    districts: [
      { name: "Puducherry", bounds: { north: 12.1, south: 11.7, east: 80.0, west: 79.7 }, mandals: ["Puducherry", "Villianur", "Ariyankuppam", "Oulgaret", "Nettapakkam", "Bahur"] },
      { name: "Karaikal", bounds: { north: 10.9, south: 10.7, east: 79.9, west: 79.7 }, mandals: ["Karaikal", "Tirumalairayanpattinam", "Nedungadu", "Kottucherry"] },
      { name: "Mahe", bounds: { north: 11.7, south: 11.6, east: 75.6, west: 75.5 }, mandals: ["Mahe", "Pallur"] },
      { name: "Yanam", bounds: { north: 16.8, south: 16.7, east: 82.2, west: 82.1 }, mandals: ["Yanam"] }
    ]
  }
];

export function getStateNames(): string[] {
  return INDIA_LOCATIONS.map(state => state.name).sort();
}

export function getDistricts(stateName: string): DistrictData[] {
  const state = INDIA_LOCATIONS.find(s => s.name === stateName);
  return state ? state.districts : [];
}

export function getMandals(stateName: string, districtName: string): string[] {
  const state = INDIA_LOCATIONS.find(s => s.name === stateName);
  if (!state) return [];
  const district = state.districts.find(d => d.name === districtName);
  return district ? district.mandals : [];
}

export function getStateBounds(stateName: string): LatLngBounds | null {
  const state = INDIA_LOCATIONS.find(s => s.name === stateName);
  return state ? state.bounds : null;
}

export function getDistrictBounds(stateName: string, districtName: string): LatLngBounds | null {
  const state = INDIA_LOCATIONS.find(s => s.name === stateName);
  if (!state) return null;
  const district = state.districts.find(d => d.name === districtName);
  return district ? district.bounds : null;
}

export function getMandalBounds(stateName: string, districtName: string, mandalName: string): LatLngBounds | null {
  const state = INDIA_LOCATIONS.find(s => s.name === stateName);
  if (!state) return null;
  const district = state.districts.find(d => d.name === districtName);
  if (!district) return null;

  const mandalIndex = district.mandals.findIndex((m) => m === mandalName);
  if (mandalIndex < 0) return district.bounds;

  const gridSize = Math.ceil(Math.sqrt(district.mandals.length));
  const row = Math.floor(mandalIndex / gridSize);
  const col = mandalIndex % gridSize;
  const latStep = (district.bounds.north - district.bounds.south) / gridSize;
  const lngStep = (district.bounds.east - district.bounds.west) / gridSize;

  return {
    north: district.bounds.north - row * latStep,
    south: district.bounds.north - (row + 1) * latStep,
    west: district.bounds.west + col * lngStep,
    east: district.bounds.west + (col + 1) * lngStep,
  };
}
