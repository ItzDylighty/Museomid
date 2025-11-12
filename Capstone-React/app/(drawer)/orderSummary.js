import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, Modal, KeyboardAvoidingView, Platform, FlatList, RefreshControl, Linking, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../supabase/supabaseClient';
import { useUser } from '../contexts/UserContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = "http://192.168.254.114:3000/api";

const OrderSummaryScreen = () => {
  const router = useRouter();
  const { userData } = useUser();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addresses, setAddresses] = useState([]);
  // Payment method removed - Xendit handles this during payment
  const [selectedShipping, setSelectedShipping] = useState('standard');
  const [orderNotes, setOrderNotes] = useState('');
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  
  // P2P Migration: Direct purchase support
  const isDirectPurchase = params.directPurchase === 'true';
  const directMarketItemId = params.marketItemId;
  const directQuantity = parseInt(params.quantity) || 1;
  
  console.log('OrderSummary params:', params);
  console.log('Direct purchase mode:', { isDirectPurchase, directMarketItemId, directQuantity });
  
  // Location data
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [citiesMunicipalities, setCitiesMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [openSelect, setOpenSelect] = useState({ region: false, province: false, city: false, barangay: false });
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    regionCode: '',
    regionName: '',
    provinceCode: '',
    provinceName: '',
    cityMunicipalityCode: '',
    cityMunicipalityName: '',
    barangayCode: '',
    barangayName: '',
    postalCode: '',
    addressType: 'home',
    deliveryInstructions: '',
    isDefault: false,
  });

  // Auto-fill user data when modal opens
  useEffect(() => {
    if (showAddAddress && userData) {
      setFormData(prev => ({
        ...prev,
        fullName: prev.fullName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
        email: prev.email || userData.email || '',
        phoneNumber: prev.phoneNumber || userData.phoneNumber || '',
      }));
    }
  }, [showAddAddress, userData]);

  // Fetch cart
  const fetchCart = async (at, rt) => {
    try {
      const response = await fetch(`${API_BASE}/marketplace/cart`, {
        method: 'GET',
        credentials: 'include',
        headers: { 
          Cookie: `access_token=${at || ''}; refresh_token=${rt || ''}`,
          'Authorization': `Bearer ${at || ''}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        if (!result.data.items || result.data.items.length === 0) {
          // Silently redirect to marketplace if cart is empty
          setCartItems([]);
          router.replace('/(drawer)/marketplace');
          return;
        }
        
        const transformedCart = result.data.items.map(item => ({
          id: item.cartItemId,
          cartItemId: item.cartItemId,
          quantity: item.quantity,
          marketItemId: item.marketplace_items?.marketItemId,
          title: item.marketplace_items?.title || 'Unknown Item',
          price: item.marketplace_items?.price || 0,
          primary_image: item.marketplace_items?.images?.[0] || null,
          artist: item.marketplace_items?.sellerProfiles?.shopName || 'Unknown',
        }));
        setCartItems(transformedCart);
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  // P2P Migration: Fetch single marketplace item for direct purchase (matches web version)
  const fetchDirectPurchaseItem = async (at, rt, marketItemId, quantity) => {
    console.log('fetchDirectPurchaseItem called with:', { marketItemId, quantity });
    
    try {
      // Use specific item endpoint like web version
      const response = await fetch(`${API_BASE}/marketplace/items/${marketItemId}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 
          Cookie: `access_token=${at || ''}; refresh_token=${rt || ''}`,
          'Authorization': `Bearer ${at || ''}`,
        },
      });

      const result = await response.json();
      console.log('API Response for item:', response.status, result);
      
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Item not found');
      }
      
      const item = result.data;
      console.log('Fetched specific item:', {
        marketItemId,
        title: item.title,
        price: item.price,
        seller: item.sellerProfiles?.shopName
      });
      
      // Transform single item to cart format (match web version structure)
      const cartItem = {
        id: marketItemId,
        cartItemId: `direct_${marketItemId}`,
        quantity: Number(quantity) || 1,
        marketItemId: marketItemId,
        title: item.title || 'Unknown Item',
        price: item.price || 0,
        primary_image: item.images?.[0] || item.primary_image || null,
        artist: item.sellerProfiles?.shopName || 'Unknown Artist',
        sellerProfileId: item.sellerProfileId
      };
      
      console.log('Created cart item:', cartItem);
      setCartItems([cartItem]);
    } catch (error) {
      console.error('Error fetching direct purchase item:', error);
      Alert.alert('Error', 'Failed to load item details');
      router.replace('/(drawer)/marketplace');
    }
  };

  // Fetch addresses
  const fetchAddresses = async (at, rt) => {
    try {
      const response = await fetch(`${API_BASE}/marketplace/addresses`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `access_token=${at || ''}; refresh_token=${rt || ''}`,
        },
      });

      const result = await response.json();
      if (!response.ok || !result?.success) return;
      
      const list = result?.data || [];
      setAddresses(list);
      const def = list.find(a => a.isDefault);
      if (def) setSelectedAddress(def.userAddressId);
      else if (list.length) setSelectedAddress(list[0].userAddressId);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  };

  // Fetch location data
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await fetch('https://psgc.gitlab.io/api/regions/');
        const data = await res.json();
        setRegions(data || []);
      } catch (e) {
        console.error('Failed to fetch regions:', e);
      }
    };
    fetchRegions();
  }, []);

  const onSelectRegion = (code) => {
    setFormData(p => ({ ...p, regionCode: code, provinceCode: '', cityMunicipalityCode: '', barangayCode: '' }));
    setProvinces([]);
    setCitiesMunicipalities([]);
    setBarangays([]);
    setOpenSelect({ region: false, province: false, city: false, barangay: false });
    
    fetch(`https://psgc.gitlab.io/api/regions/${code}/provinces/`)
      .then(res => res.json())
      .then(data => setProvinces(data || []))
      .catch(e => console.error('Failed to fetch provinces:', e));
  };

  const onSelectProvince = (code) => {
    setFormData(p => ({ ...p, provinceCode: code, cityMunicipalityCode: '', barangayCode: '' }));
    setCitiesMunicipalities([]);
    setBarangays([]);
    setOpenSelect(s => ({ ...s, province: false }));
    
    fetch(`https://psgc.gitlab.io/api/provinces/${code}/cities-municipalities/`)
      .then(res => res.json())
      .then(data => setCitiesMunicipalities(data || []))
      .catch(e => console.error('Failed to fetch cities:', e));
  };

  const onSelectCity = (code) => {
    setFormData(p => ({ ...p, cityMunicipalityCode: code, barangayCode: '' }));
    setBarangays([]);
    setOpenSelect(s => ({ ...s, city: false }));
    
    fetch(`https://psgc.gitlab.io/api/cities-municipalities/${code}/barangays/`)
      .then(res => res.json())
      .then(data => setBarangays(data || []))
      .catch(e => console.error('Failed to fetch barangays:', e));
  };

  const onSelectBarangay = (code) => {
    setFormData(p => ({ ...p, barangayCode: code }));
    setOpenSelect(s => ({ ...s, barangay: false }));
  };

  useEffect(() => {
    const init = async () => {
      console.log('OrderSummary useEffect init called');
      console.log('userData:', userData);
      console.log('Direct purchase check:', { isDirectPurchase, directMarketItemId, directQuantity });
      
      if (!userData) {
        Alert.alert('Login Required', 'Please login to checkout');
        router.push('/');
        return;
      }
      
      try {
        const { data } = await supabase.auth.getSession();
        const at = data?.session?.access_token || null;
        const rt = data?.session?.refresh_token || null;
        console.log('Session tokens:', { at: !!at, rt: !!rt });
        
        setAccessToken(at);
        setRefreshToken(rt);
        setLoading(true);
        
        // P2P Migration: Handle direct purchase vs cart-based checkout
        if (isDirectPurchase && directMarketItemId) {
          console.log('Direct purchase mode - fetching item:', directMarketItemId);
          await Promise.all([
            fetchDirectPurchaseItem(at, rt, directMarketItemId, directQuantity),
            fetchAddresses(at, rt),
          ]);
        } else {
          console.log('Cart mode - fetching cart');
          await Promise.all([
            fetchCart(at, rt),
            fetchAddresses(at, rt),
          ]);
        }
      } catch (error) {
        console.error('Error in init:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userData, isDirectPurchase, directMarketItemId, directQuantity]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // P2P Migration: Handle direct purchase vs cart-based checkout
      if (isDirectPurchase && directMarketItemId) {
        await Promise.all([
          fetchDirectPurchaseItem(accessToken, refreshToken, directMarketItemId, directQuantity),
          fetchAddresses(accessToken, refreshToken),
        ]);
      } else {
        await Promise.all([
          fetchCart(accessToken, refreshToken),
          fetchAddresses(accessToken, refreshToken),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const validateAddressForm = () => {
    if (!formData.fullName?.trim()) return 'Full name is required';
    if (!formData.email?.trim()) return 'Email is required';
    if (!formData.phoneNumber?.trim()) return 'Phone number is required';
    if (!formData.addressLine1?.trim()) return 'Street address is required';
    if (!formData.regionCode) return 'Region is required';
    if (!formData.provinceCode) return 'Province is required';
    if (!formData.cityMunicipalityCode) return 'City/Municipality is required';
    if (!formData.barangayCode) return 'Barangay is required';
    if (!/^[0-9]{4}$/.test(String(formData.postalCode || ''))) return 'Postal code must be 4 digits';
    return '';
  };

  const handleSaveAddress = async () => {
    const error = validateAddressForm();
    if (error) {
      Alert.alert('Invalid Form', error);
      return;
    }

    try {
      setIsSubmitting(true);
      const selRegion = regions.find(r => r.code === formData.regionCode);
      const selProv = provinces.find(p => p.code === formData.provinceCode);
      const selCity = citiesMunicipalities.find(c => c.code === formData.cityMunicipalityCode);
      const selBrgy = barangays.find(b => b.code === formData.barangayCode);

      const addressData = {
        ...formData,
        regionName: selRegion?.name || '',
        provinceName: selProv?.name || '',
        cityMunicipalityName: selCity?.name || '',
        barangayName: selBrgy?.name || '',
      };

      const response = await fetch(`${API_BASE}/marketplace/addresses`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `access_token=${accessToken || ''}; refresh_token=${refreshToken || ''}`,
        },
        body: JSON.stringify(addressData)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Failed to save address');

      Alert.alert('Success', 'Address saved successfully');
      setShowAddAddress(false);
      setFormData({
        fullName: '',
        email: '',
        phoneNumber: '',
        addressLine1: '',
        addressLine2: '',
        landmark: '',
        regionCode: '',
        regionName: '',
        provinceCode: '',
        provinceName: '',
        cityMunicipalityCode: '',
        cityMunicipalityName: '',
        barangayCode: '',
        barangayName: '',
        postalCode: '',
        addressType: 'home',
        deliveryInstructions: '',
        isDefault: false,
      });
      await fetchAddresses(accessToken, refreshToken);
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', error?.message || 'Failed to save address');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubtotal = useMemo(() => () => cartItems.reduce((t, i) => t + (Number(i.price || 0) * Number(i.quantity || 0)), 0), [cartItems]);
  
  const getShippingCost = useMemo(() => () => {
    const costs = { standard: 100, express: 250, priority: 500 };
    return costs[selectedShipping] || 0;
  }, [selectedShipping]);
  
  const getTotal = useMemo(() => () => getSubtotal() + getShippingCost(), [getSubtotal, getShippingCost]);

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Missing address', 'Please select a delivery address');
      return;
    }
    
    if (!cartItems || cartItems.length === 0) {
      Alert.alert('No items', 'No items found to place order');
      return;
    }
    
    try {
      setLoading(true);
      const address = addresses.find(a => a.userAddressId === selectedAddress);
      
      // Match web version order data structure exactly
      const item = cartItems[0]; // For direct purchase, we only have one item
      const shippingFee = getShippingCost();
      
      const orderData = {
        marketItemId: item.marketItemId,
        quantity: item.quantity,
        shippingFee,
        shippingMethod: selectedShipping,
        orderNotes: orderNotes || 'None',
        shippingAddress: {
          fullName: address?.fullName,
          phone: address?.phoneNumber || address?.phone,
          addressLine1: address?.addressLine1 || address?.street,
          addressLine2: address?.addressLine2 || '',
          barangayName: address?.barangayName || address?.barangay,
          cityMunicipalityName: address?.cityMunicipalityName || address?.city,
          provinceName: address?.provinceName || address?.province,
          postalCode: address?.postalCode,
          landmark: address?.landmark || ''
        },
        contactInfo: {
          name: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
          email: userData?.email || '',
          phone: address?.phoneNumber || address?.phone || ''
        }
      };

      console.log('Order data being sent:', JSON.stringify(orderData, null, 2));
      console.log('Cart items:', cartItems);
      console.log('Is direct purchase:', isDirectPurchase);

      const response = await fetch(`${API_BASE}/marketplace/orders/buy-now`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `access_token=${accessToken || ''}; refresh_token=${refreshToken || ''}`,
        },
        body: JSON.stringify(orderData),
      });
      
      const result = await response.json();
      console.log('API Response:', response.status, result);
      
      if (!response.ok || result.success === false) {
        console.error('Order creation failed:', result);
        throw new Error(result?.error || result?.message || `Failed to create order (${response.status})`);
      }
      
      // Match web version response handling
      const checkoutUrl = result?.data?.checkoutUrl || result?.checkoutUrl;
      
      if (!checkoutUrl) {
        throw new Error('No checkout URL returned');
      }
      
      // Open Xendit payment page and navigate to orders
      Alert.alert(
        'Order Created',
        'Order created successfully! Please complete payment in the browser.',
        [
          {
            text: 'Open Payment',
            onPress: async () => {
              try {
                await Linking.openURL(checkoutUrl);
                router.push('/(drawer)/myOrders');
              } catch (e) {
                console.error('Failed to open payment URL:', e);
                Alert.alert('Error', 'Failed to open payment page');
              }
            }
          },
          {
            text: 'Later',
            onPress: () => router.push('/(drawer)/myOrders'),
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', error?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Custom Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.push('/(drawer)/marketplace')}
              hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
              activeOpacity={0.6}
            >
              <Ionicons name="arrow-back" size={26} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Checkout</Text>
          </View>
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A68C7B" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.push('/(drawer)/marketplace')}
            hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
            activeOpacity={0.6}
          >
            <Ionicons name="arrow-back" size={26} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
        </View>
      </View>
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#A68C7B"]} tintColor="#A68C7B" />
        }
      >
        {/* Cart Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items ({cartItems.length})</Text>
          {cartItems.map(item => (
            <View key={item.cartItemId} style={styles.cartItem}>
              <Image 
                source={item.primary_image ? { uri: item.primary_image } : require('../../assets/pic1.jpg')}
                style={styles.itemImage}
              />
              <View style={styles.itemDetails}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.itemSeller}>by {item.sellerName}</Text>
                <Text style={styles.itemPrice}>₱{item.price} × {item.quantity}</Text>
              </View>
              <Text style={styles.itemTotal}>₱{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          {addresses.length === 0 ? (
            <TouchableOpacity style={styles.addAddressBtn} onPress={() => setShowAddAddress(true)}>
              <Ionicons name="add-circle-outline" size={24} color="#A68C7B" />
              <Text style={styles.addAddressText}>Add Delivery Address</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.addMoreAddressBtn} onPress={() => setShowAddAddress(true)}>
                <Ionicons name="add-circle-outline" size={20} color="#A68C7B" />
                <Text style={styles.addMoreAddressText}>Add New Address</Text>
              </TouchableOpacity>
              {addresses.map(addr => (
                <TouchableOpacity
                  key={addr.userAddressId}
                  style={[styles.addressCard, selectedAddress === addr.userAddressId && styles.addressCardSelected]}
                  onPress={() => setSelectedAddress(addr.userAddressId)}
                >
                  <View style={styles.addressRadio}>
                    {selectedAddress === addr.userAddressId && <View style={styles.addressRadioSelected} />}
                  </View>
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressName}>{addr.fullName}</Text>
                    <Text style={styles.addressText}>{addr.addressLine1}</Text>
                    <Text style={styles.addressText}>{addr.barangayName}, {addr.cityMunicipalityName}</Text>
                    <Text style={styles.addressText}>{addr.phoneNumber}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        {/* Shipping Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipping Method</Text>
          {['standard', 'express', 'priority'].map(method => (
            <TouchableOpacity
              key={method}
              style={[styles.optionCard, selectedShipping === method && styles.optionCardSelected]}
              onPress={() => setSelectedShipping(method)}
            >
              <View style={styles.optionRadio}>
                {selectedShipping === method && <View style={styles.optionRadioSelected} />}
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>
                  {method === 'standard' && 'Standard (5-7 days)'}
                  {method === 'express' && 'Express (2-3 days)'}
                  {method === 'priority' && 'Priority (1 day)'}
                </Text>
              </View>
              <Text style={styles.optionPrice}>
                ₱{method === 'standard' ? '100' : method === 'express' ? '250' : '500'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment Method Section Removed - Xendit handles payment method selection */}

        {/* Order Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add special instructions..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            value={orderNotes}
            onChangeText={setOrderNotes}
          />
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>₱{getSubtotal().toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping:</Text>
            <Text style={styles.summaryValue}>₱{getShippingCost().toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>₱{getTotal().toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.placeOrderBtn, processing && styles.placeOrderBtnDisabled]}
          onPress={handlePlaceOrder}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.placeOrderText}>Place Order</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Add Address Modal */}
      <Modal
        visible={showAddAddress}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddAddress(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Address</Text>
              <TouchableOpacity onPress={() => setShowAddAddress(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={{ maxHeight: '80%' }} 
              contentContainerStyle={{ paddingBottom: 16 }} 
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Personal Information */}
              <Text style={styles.sectionTitleModal}>Personal Information</Text>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Full Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.fullName}
                  onChangeText={(t) => setFormData(p => ({ ...p, fullName: t }))}
                  placeholder="Juan Dela Cruz"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.formRowModal}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Email *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.email}
                    onChangeText={(t) => setFormData(p => ({ ...p, email: t }))}
                    placeholder="juan@example.com"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.phoneNumber}
                    onChangeText={(t) => setFormData(p => ({ ...p, phoneNumber: t }))}
                    placeholder="09123456789"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Address Details */}
              <Text style={styles.sectionTitleModal}>Address Details</Text>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>House/Unit No., Building, Street Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.addressLine1}
                  onChangeText={(t) => setFormData(p => ({ ...p, addressLine1: t }))}
                  placeholder="123 Main St, Unit 4B"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Subdivision/Village/Building (Optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.addressLine2}
                  onChangeText={(t) => setFormData(p => ({ ...p, addressLine2: t }))}
                  placeholder="Green Valley Subd."
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Landmark (Optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.landmark}
                  onChangeText={(t) => setFormData(p => ({ ...p, landmark: t }))}
                  placeholder="Near ABC Store"
                  placeholderTextColor="#999"
                />
              </View>

              {/* Location */}
              <Text style={styles.sectionTitleModal}>Location</Text>
              
              {/* Region */}
              <View style={styles.selectGroup}>
                <Text style={styles.formLabel}>Region *</Text>
                <View style={styles.selectBox}>
                  <TouchableOpacity
                    style={styles.selectTrigger}
                    onPress={() => setOpenSelect(s => ({ ...s, region: !s.region }))}
                  >
                    <Text style={styles.selectTriggerText}>
                      {regions.find(r => r.code === formData.regionCode)?.name || 'Select Region'}
                    </Text>
                    <Ionicons name={openSelect.region ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                  </TouchableOpacity>
                  {openSelect.region && (
                    <FlatList
                      data={regions}
                      keyExtractor={(item) => String(item.code)}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.selectItem, formData.regionCode === item.code && styles.selectItemActive]}
                          onPress={() => onSelectRegion(item.code)}
                        >
                          <Text style={styles.selectItemText}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                      style={{ maxHeight: 200 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    />
                  )}
                </View>
              </View>

              {/* Province */}
              <View style={styles.selectGroup}>
                <Text style={styles.formLabel}>Province *</Text>
                <View style={styles.selectBox}>
                  <TouchableOpacity
                    style={styles.selectTrigger}
                    onPress={() => setOpenSelect(s => ({ ...s, province: !s.province }))}
                  >
                    <Text style={styles.selectTriggerText}>
                      {provinces.find(p => p.code === formData.provinceCode)?.name || 'Select Province'}
                    </Text>
                    <Ionicons name={openSelect.province ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                  </TouchableOpacity>
                  {openSelect.province && (
                    <FlatList
                      data={provinces}
                      keyExtractor={(item) => String(item.code)}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.selectItem, formData.provinceCode === item.code && styles.selectItemActive]}
                          onPress={() => onSelectProvince(item.code)}
                        >
                          <Text style={styles.selectItemText}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                      style={{ maxHeight: 200 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    />
                  )}
                </View>
              </View>

              {/* City/Municipality */}
              <View style={styles.selectGroup}>
                <Text style={styles.formLabel}>City/Municipality *</Text>
                <View style={styles.selectBox}>
                  <TouchableOpacity
                    style={styles.selectTrigger}
                    onPress={() => setOpenSelect(s => ({ ...s, city: !s.city }))}
                  >
                    <Text style={styles.selectTriggerText}>
                      {citiesMunicipalities.find(c => c.code === formData.cityMunicipalityCode)?.name || 'Select City/Municipality'}
                    </Text>
                    <Ionicons name={openSelect.city ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                  </TouchableOpacity>
                  {openSelect.city && (
                    <FlatList
                      data={citiesMunicipalities}
                      keyExtractor={(item) => String(item.code)}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.selectItem, formData.cityMunicipalityCode === item.code && styles.selectItemActive]}
                          onPress={() => onSelectCity(item.code)}
                        >
                          <Text style={styles.selectItemText}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                      style={{ maxHeight: 200 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    />
                  )}
                </View>
              </View>

              {/* Barangay */}
              <View style={styles.selectGroup}>
                <Text style={styles.formLabel}>Barangay *</Text>
                <View style={styles.selectBox}>
                  <TouchableOpacity
                    style={styles.selectTrigger}
                    onPress={() => setOpenSelect(s => ({ ...s, barangay: !s.barangay }))}
                  >
                    <Text style={styles.selectTriggerText}>
                      {barangays.find(b => b.code === formData.barangayCode)?.name || 'Select Barangay'}
                    </Text>
                    <Ionicons name={openSelect.barangay ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                  </TouchableOpacity>
                  {openSelect.barangay && (
                    <FlatList
                      data={barangays}
                      keyExtractor={(item) => String(item.code)}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.selectItem, formData.barangayCode === item.code && styles.selectItemActive]}
                          onPress={() => onSelectBarangay(item.code)}
                        >
                          <Text style={styles.selectItemText}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                      style={{ maxHeight: 200 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    />
                  )}
                </View>
              </View>

              {/* Additional Options */}
              <Text style={styles.sectionTitleModal}>Additional Options</Text>
              <View style={styles.formRowModal}>
                {['home', 'office', 'other'].map(val => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.typeChip, formData.addressType === val && styles.typeChipActive]}
                    onPress={() => setFormData(p => ({ ...p, addressType: val }))}
                  >
                    <Text style={[styles.typeChipText, formData.addressType === val && styles.typeChipTextActive]}>
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Postal Code *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.postalCode}
                  onChangeText={(t) => setFormData(p => ({ ...p, postalCode: t }))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="1234"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Delivery Instructions (Optional)</Text>
                <TextInput
                  style={styles.textareaModal}
                  value={formData.deliveryInstructions}
                  onChangeText={(t) => setFormData(p => ({ ...p, deliveryInstructions: t }))}
                  multiline
                  numberOfLines={3}
                  placeholder="Any special delivery instructions..."
                  placeholderTextColor="#999"
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 1 }]}
                onPress={() => setShowAddAddress(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ width: 10 }} />
              <TouchableOpacity
                style={[styles.saveAddressBtn, { flex: 1 }]}
                onPress={handleSaveAddress}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveAddressBtnText}>Save Address</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FA',
  },
  
  // Custom Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14,
    paddingBottom: 10,
    backgroundColor: '#fff',
    height: 60,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 12,
    minWidth: 56,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C1810',
    marginBottom: 16,
  },
  cartItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D8',
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#E8E0D8',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C1810',
    marginBottom: 4,
  },
  itemSeller: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 12,
    color: '#A68C7B',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1810',
    marginLeft: 8,
  },
  addressCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    marginBottom: 12,
  },
  addressCardSelected: {
    borderColor: '#A68C7B',
    backgroundColor: '#FFF8F3',
  },
  addressRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#A68C7B',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressRadioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#A68C7B',
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C1810',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A68C7B',
    borderStyle: 'dashed',
  },
  addAddressText: {
    fontSize: 14,
    color: '#A68C7B',
    marginLeft: 8,
    fontWeight: '600',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    marginBottom: 12,
  },
  optionCardSelected: {
    borderColor: '#A68C7B',
    backgroundColor: '#FFF8F3',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#A68C7B',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#A68C7B',
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C1810',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    color: '#666',
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A68C7B',
  },
  cardFormContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E0D8',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E8E0D8',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#2C1810',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  summarySection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C1810',
  },
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E0D8',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C1810',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#A68C7B',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E0D8',
  },
  placeOrderBtn: {
    backgroundColor: '#A68C7B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  placeOrderBtnDisabled: {
    opacity: 0.6,
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  addMoreAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A68C7B',
    marginBottom: 12,
  },
  addMoreAddressText: {
    fontSize: 14,
    color: '#A68C7B',
    marginLeft: 8,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C1810',
  },
  sectionTitleModal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1810',
    marginTop: 16,
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C1810',
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E8E0D8',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#2C1810',
    backgroundColor: '#fff',
  },
  formRowModal: {
    flexDirection: 'row',
  },
  selectGroup: {
    marginBottom: 16,
  },
  selectBox: {
    borderWidth: 1,
    borderColor: '#E8E0D8',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  selectTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  selectTriggerText: {
    fontSize: 14,
    color: '#2C1810',
    flex: 1,
  },
  selectItem: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E0D8',
  },
  selectItemActive: {
    backgroundColor: '#FFF8F3',
  },
  selectItemText: {
    fontSize: 14,
    color: '#2C1810',
  },
  typeChip: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E0D8',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  typeChipActive: {
    backgroundColor: '#A68C7B',
    borderColor: '#A68C7B',
  },
  typeChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#fff',
  },
  textareaModal: {
    borderWidth: 1,
    borderColor: '#E8E0D8',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#2C1810',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    marginTop: 16,
  },
  cancelBtn: {
    backgroundColor: '#666',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  saveAddressBtn: {
    backgroundColor: '#A68C7B',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveAddressBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default OrderSummaryScreen;
