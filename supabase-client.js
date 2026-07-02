/**
 * Supabase Client Helper Functions
 * 
 * This file contains all the functions needed to interact with Supabase
 * Make sure to include supabase-config.js before this file
 */

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================================
// AUTHENTICATION FUNCTIONS
// ===================================

/**
 * Sign up a new user with email and password
 * @param {string} email 
 * @param {string} password 
 * @param {object} userData - Additional user info (user_type, full_name, phone)
 * @returns {Promise<object>} User data or error
 */
async function signUp(email, password, userData = {}) {
  try {
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password
    });

    if (authError) throw authError;

    // Create user profile
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .insert([{
        id: authData.user.id,
        email,
        full_name: userData.full_name || '',
        phone: userData.phone || '',
        user_type: userData.user_type || 'user'
      }]);

    if (profileError) throw profileError;

    return { success: true, user: authData.user, profile: profileData };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sign in an existing user
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>} User data or error
 */
async function signIn(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Store session info in localStorage if needed
    return { success: true, user: data.user, session: data.session };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sign out the current user
 * @returns {Promise<object>} Success or error
 */
async function signOut() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the current logged-in user
 * @returns {Promise<object>} Current user or null
 */
async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) {
      // Silently return null if no session exists (this is expected behavior)
      if (error.message.includes('session missing')) {
        return null;
      }
      throw error;
    }
    return user;
  } catch (error) {
    // Only log actual errors, not missing sessions
    if (!error.message.includes('session missing')) {
      console.error('Get current user error:', error);
    }
    return null;
  }
}

/**
 * Get current user's profile information
 * @returns {Promise<object>} User profile data or null
 */
async function getUserProfile() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get user profile error:', error);
    return null;
  }
}

/**
 * Update user profile
 * @param {object} updates - Fields to update (full_name, phone, etc)
 * @returns {Promise<object>} Updated profile or error
 */
async function updateUserProfile(updates) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user logged in');

    const { data, error } = await supabaseClient
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, profile: data };
  } catch (error) {
    console.error('Update profile error:', error);
    return { success: false, error: error.message };
  }
}

// ===================================
// DONOR FUNCTIONS
// ===================================

/**
 * Create a new donor profile
 * @param {object} donorData - blood_type, status, personalInformation, medicalHistory
 * @returns {Promise<object>} Created donor data or error
 */
async function createDonorProfile(donorData) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user logged in');

    const profileId = user.id;
    const personalInformation = donorData.personalInformation || {};
    const medicalHistory = donorData.medicalHistory || {};

    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .upsert([{
        id: profileId,
        email: personalInformation.email || user.email || '',
        full_name: [personalInformation.first_name, personalInformation.last_name]
          .filter(Boolean)
          .join(' ')
          .trim(),
        phone: personalInformation.phone_number || personalInformation.mobile_number || '',
        user_type: 'donor'
      }], { onConflict: 'id' })
      .select()
      .single();

    if (profileError) throw profileError;

    const { data: personalInformationData, error: personalInformationError } = await supabaseClient
      .from('personal_information')
      .upsert([{
        profile_id: profileId,
        first_name: personalInformation.first_name || '',
        last_name: personalInformation.last_name || '',
        birthdate: personalInformation.birthdate || personalInformation.date_of_birth || null,
        email: personalInformation.email || user.email || '',
        phone_number: personalInformation.phone_number || personalInformation.mobile_number || '',
        emergency_contact: personalInformation.emergency_contact || personalInformation.emergency_contact_name || '',
        street_address: personalInformation.street_address || personalInformation.address || '',
        city: personalInformation.city || '',
        region: personalInformation.region || personalInformation.province || '',
        emergency_contact_number: personalInformation.emergency_contact_number || ''
      }], { onConflict: 'profile_id' })
      .select()
      .single();

    if (personalInformationError) throw personalInformationError;

    const { data: medicalHistoryData, error: medicalHistoryError } = await supabaseClient
      .from('medical_history')
      .upsert([{
        profile_id: profileId,
        lactating_excess: Boolean(medicalHistory.q_lactating),
        willing_for_mandatory_blood_test: Boolean(medicalHistory.q_blood_test),
        history_chronic_conditions: Boolean(medicalHistory.q_chronic),
        had_blood_transfusion_or_surgery: Boolean(medicalHistory.q_transfusion),
        taking_medications_or_supplements: Boolean(medicalHistory.q_medications),
        regularly_taking_otc_or_herbal_remedies: Boolean(medicalHistory.q_otc),
        uses_tobacco_or_vaping: Boolean(medicalHistory.q_tobacco),
        consumes_alcohol_or_drugs: Boolean(medicalHistory.q_alcohol_drugs),
        has_tattoo_or_piercing: Boolean(medicalHistory.q_tattoo)
      }], { onConflict: 'profile_id' })
      .select()
      .single();

    if (medicalHistoryError) throw medicalHistoryError;

    const { data, error } = await supabaseClient
      .from('donors')
      .upsert([{
        user_id: user.id,
        blood_type: donorData.blood_type || '',
        status: donorData.status || 'active',
        donation_count: 0
      }], { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return {
      success: true,
      profile: profileData,
      personalInformation: personalInformationData,
      medicalHistory: medicalHistoryData,
      donor: data
    };
  } catch (error) {
    console.error('Create donor profile error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all active donors (public data)
 * @returns {Promise<array>} Array of donors or empty array
 */
async function getActiveDonors() {
  try {
    const { data, error } = await supabaseClient
      .from('donors')
      .select('*, profiles(full_name, email)')
      .eq('status', 'active');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get active donors error:', error);
    return [];
  }
}

/**
 * Get current user's donor profile
 * @returns {Promise<object>} Donor profile or null
 */
async function getCurrentUserDonor() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
      .from('donors')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data || null;
  } catch (error) {
    console.error('Get current donor error:', error);
    return null;
  }
}

// ===================================
// PRODUCT/INVENTORY FUNCTIONS
// ===================================

/**
 * Get all products
 * @param {string} category - Optional: filter by category
 * @returns {Promise<array>} Array of products
 */
async function getProducts(category = null) {
  try {
    let query = supabaseClient.from('products').select('*');
    
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get products error:', error);
    return [];
  }
}

async function getInventory(category = null) {
  try {
    let query = supabaseClient.from('inventory').select('*');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    // store debug info on window for easier inspection in the browser console
    window.supabaseDebug = window.supabaseDebug || {};
    window.supabaseDebug.lastInventoryData = data || [];
    window.supabaseDebug.lastInventoryError = error || null;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get inventory error:', error);
    return [];
  }
}

/**
 * Get a single product by ID
 * @param {string} productId 
 * @returns {Promise<object>} Product data or null
 */
async function getProduct(productId) {
  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get product error:', error);
    return null;
  }
}

/**
 * Add a new product (staff/admin only)
 * @param {object} productData - name, description, sku, quantity_in_stock, unit_price, category
 * @returns {Promise<object>} Created product or error
 */
async function addProduct(productData) {
  try {
    const { data, error } = await supabaseClient
      .from('products')
      .insert([{
        name: productData.name,
        description: productData.description || '',
        sku: productData.sku,
        quantity_in_stock: productData.quantity_in_stock || 0,
        unit_price: productData.unit_price || 0,
        category: productData.category || 'general'
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, product: data };
  } catch (error) {
    console.error('Add product error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update product inventory
 * @param {string} productId 
 * @param {number} newQuantity 
 * @returns {Promise<object>} Updated product or error
 */
async function updateProductInventory(productId, newQuantity) {
  try {
    const { data, error } = await supabaseClient
      .from('products')
      .update({ quantity_in_stock: newQuantity })
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, product: data };
  } catch (error) {
    console.error('Update inventory error:', error);
    return { success: false, error: error.message };
  }
}

// ===================================
// DONATION FUNCTIONS
// ===================================

/**
 * Record a new donation
 * @param {object} donationData - amount_ml, notes, status
 * @returns {Promise<object>} Created donation or error
 */
async function recordDonation(donationData) {
  try {
    const donor = await getCurrentUserDonor();
    if (!donor) throw new Error('User is not a registered donor');

    const { data, error } = await supabaseClient
      .from('donations')
      .insert([{
        donor_id: donor.id,
        amount_ml: donationData.amount_ml || 0,
        notes: donationData.notes || '',
        status: donationData.status || 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, donation: data };
  } catch (error) {
    console.error('Record donation error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's donation history
 * @returns {Promise<array>} Array of donations
 */
async function getUserDonationHistory() {
  try {
    const donor = await getCurrentUserDonor();
    if (!donor) return [];

    const { data, error } = await supabaseClient
      .from('donations')
      .select('*')
      .eq('donor_id', donor.id)
      .order('donation_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get donation history error:', error);
    return [];
  }
}

/**
 * Get all donations (admin/staff only)
 * @returns {Promise<array>} Array of all donations
 */
async function getAllDonations() {
  try {
    const { data, error } = await supabaseClient
      .from('donations')
      .select('*, donors(profile(full_name))')
      .order('donation_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get all donations error:', error);
    return [];
  }
}

// ===================================
// STAFF FUNCTIONS
// ===================================

/**
 * Create a staff member record (admin only)
 * @param {string} userId - User ID from profiles table
 * @param {object} staffData - role, center_location, hire_date
 * @returns {Promise<object>} Created staff record or error
 */
async function createStaffMember(userId, staffData) {
  try {
    const { data, error } = await supabaseClient
      .from('staff')
      .insert([{
        user_id: userId,
        role: staffData.role || 'technician', // 'center_manager', 'technician', 'admin'
        center_location: staffData.center_location || '',
        hire_date: staffData.hire_date || new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, staff: data };
  } catch (error) {
    console.error('Create staff member error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a staff member (admin only)
 * @param {string} staffId - Staff record ID
 * @param {object} updates - Fields to update (role, center_location, etc)
 * @returns {Promise<object>} Updated staff or error
 */
async function updateStaffMember(staffId, updates) {
  try {
    const { data, error } = await supabaseClient
      .from('staff')
      .update(updates)
      .eq('id', staffId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, staff: data };
  } catch (error) {
    console.error('Update staff member error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a staff member (admin only)
 * @param {string} staffId - Staff record ID
 * @returns {Promise<object>} Success or error
 */
async function deleteStaffMember(staffId) {
  try {
    const { error } = await supabaseClient
      .from('staff')
      .delete()
      .eq('id', staffId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete staff member error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all staff members (admin only)
 * @returns {Promise<array>} Array of staff members
 */
async function getAllStaff() {
  try {
    const { data, error } = await supabaseClient
      .from('staff')
      .select('*, profiles(full_name, email)');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get staff error:', error);
    return [];
  }
}

/**
 * Add a new inventory batch
 * @param {object} batchData - batch_number, program, volume_available, expiry_date, status
 * @returns {Promise<object>} Created batch or error
 */
async function addInventoryBatch(batchData) {
  try {
    const { data, error } = await supabaseClient
      .from('inventory')
      .insert([batchData])
      .select()
      .single();

    if (error) throw error;
    return { success: true, batch: data };
  } catch (error) {
    console.error('Add inventory batch error:', error);
    return { success: false, error: error.message };
  }
}

// Make functions available globally
window.supabase = {
  signUp, signIn, signOut, getCurrentUser, getUserProfile, updateUserProfile,
  createDonorProfile, getActiveDonors, getCurrentUserDonor,
  getInventory, addInventoryBatch, getProducts, getProduct, addProduct, updateProductInventory,
  recordDonation, getUserDonationHistory, getAllDonations,
  createStaffMember, updateStaffMember, deleteStaffMember, getAllStaff
};
