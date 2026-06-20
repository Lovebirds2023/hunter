export const DOG_BREEDS = [
    "Mutina (local breed)", "Akita", "Australian Shepherd", "Basenji", "Beagle", "Boerboel", "Border Collie", 
    "Bosco", "Boston Terrier", "Boxer", "Bulldog", "Cane Corso", "Chihuahua", 
    "Chow Chow", "Corgi", "Dachshund", "Dalmatian", "Doberman Pinscher", 
    "French Bulldog", "German Shepherd", "Golden Retriever", "Great Dane", 
    "Havanese", "Jack Russell Terrier", "Labrador Retriever", "Maltese", 
    "Pomeranian", "Poodle", "Pug", "Rhodesian Ridgeback", "Rottweiler", 
    "Shih Tzu", "Siberian Husky", "Staffordshire Bull Terrier", "Yorkshire Terrier",
    "Mixed Breed", "Other"
];

export const CAT_BREEDS = [
    "Local Cat (Unknown Breed)",
    "Abyssinian Cat",
    "American Bobtail",
    "American Curl",
    "American Shorthair",
    "American Wirehair",
    "Balinese Cat",
    "Bengal Cat",
    "Birman",
    "Bombay Cat",
    "British Longhair",
    "British Shorthair",
    "Burmese Cat",
    "Burmilla",
    "Chartreux",
    "Cornish Rex",
    "Devon Rex",
    "Egyptian Mau",
    "Exotic Shorthair",
    "Havana Brown",
    "Himalayan Cat",
    "Japanese Bobtail",
    "Korat",
    "LaPerm",
    "Maine Coon",
    "Manx Cat",
    "Norwegian Forest Cat",
    "Ocicat",
    "Oriental Shorthair",
    "Persian Cat",
    "Peterbald",
    "Pixie-bob",
    "Ragdoll",
    "Russian Blue",
    "Savannah Cat",
    "Scottish Fold",
    "Selkirk Rex",
    "Siamese Cat",
    "Siberian Cat",
    "Singapura",
    "Snowshoe Cat",
    "Somali Cat",
    "Sphynx Cat",
    "Tonkinese Cat",
    "Toyger",
    "Turkish Angora",
    "Turkish Van",
    "Other"
];

export const BREEDS = DOG_BREEDS;

export const DOG_COLORS_DESC = [
    { value: 'Black', key: 'black' },
    { value: 'White', key: 'white' },
    { value: 'Brown', key: 'brown' },
    { value: 'Tan', key: 'tan' },
    { value: 'Spotted', key: 'spotted' },
    { value: 'Merle', key: 'merle' },
    { value: 'Brindle', key: 'brindle' },
    { value: 'Other', key: 'other' },
];

export const CAT_COLORS_DESC = [
    { value: 'Black', key: 'black' },
    { value: 'White', key: 'white' },
    { value: 'Gray', key: 'gray' },
    { value: 'Orange / Ginger', key: 'orange_ginger' },
    { value: 'Cream', key: 'cream' },
    { value: 'Brown', key: 'brown' },
    { value: 'Tabby', key: 'tabby' },
    { value: 'Calico', key: 'calico' },
    { value: 'Tortoiseshell', key: 'tortoiseshell' },
    { value: 'Bicolor', key: 'bicolor' },
    { value: 'Pointed', key: 'pointed' },
    { value: 'Other', key: 'other' },
];

export const COLORS_DESC = DOG_COLORS_DESC;

export const getBreedsForPetType = (petType) => (
    String(petType).toLowerCase() === 'cat' ? CAT_BREEDS : DOG_BREEDS
);

export const getColorsForPetType = (petType) => (
    String(petType).toLowerCase() === 'cat' ? CAT_COLORS_DESC : DOG_COLORS_DESC
);
