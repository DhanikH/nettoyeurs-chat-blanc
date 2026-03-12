import { createClient } from '@sanity/client';

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID;
const dataset = import.meta.env.VITE_SANITY_DATASET || 'production';

export const sanityClient = projectId 
  ? createClient({
      projectId,
      dataset,
      useCdn: false,
      apiVersion: '2023-05-03',
      token: import.meta.env.VITE_SANITY_WRITE_TOKEN,
    })
  : null;

export interface CmsContent {
  title: string;
  body: string;
  image?: string;
}

export interface SanityCleaner {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  bio: string;
  image?: {
    asset: {
      _ref: string;
    }
  };
  imageUrl?: string; // We will resolve this
}

export interface SanityApplicant {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  bio: string;
  cvUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export const createCmsEntry = async (type: string, data: any): Promise<any> => {
  if (!sanityClient || !import.meta.env.VITE_SANITY_WRITE_TOKEN) {
    console.warn('Sanity Write Token not configured.');
    return null;
  }

  try {
    const result = await sanityClient.create({
      _type: type,
      ...data
    });
    return result;
  } catch (error) {
    console.error(`Error creating ${type} in Sanity:`, error);
    throw error;
  }
};

export const deleteCmsEntry = async (id: string): Promise<any> => {
  if (!sanityClient || !import.meta.env.VITE_SANITY_WRITE_TOKEN) {
    return null;
  }

  try {
    const result = await sanityClient.delete(id);
    return result;
  } catch (error) {
    console.error(`Error deleting entry ${id} in Sanity:`, error);
    throw error;
  }
};

export const fetchCmsContent = async (type: string): Promise<any[]> => {
  if (!sanityClient) {
    console.warn('Sanity Project ID not configured. Returning empty content.');
    return [];
  }

  try {
    const query = `*[_type == "${type}"]`;
    const result = await sanityClient.fetch(query);
    return result;
  } catch (error) {
    console.error(`Error fetching ${type} from Sanity:`, error);
    return [];
  }
};
