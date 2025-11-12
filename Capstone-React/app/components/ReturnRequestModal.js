import React, { useState, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, ActivityIndicator, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../supabase/supabaseClient';

const API_BASE = "http://192.168.254.114:3000/api";

const ReturnRequestModal = ({ visible, onClose, order, onReturnSubmitted }) => {
  const [reason, setReason] = useState('defective_damaged');
  const [description, setDescription] = useState('');
  const [evidenceImages, setEvidenceImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Check if order is delivered (matches web logic)
  const isDelivered = useMemo(() => order?.status === 'delivered', [order]);

  const returnReasons = [
    { value: 'defective_damaged', label: 'Defective / Damaged' },
    { value: 'wrong_item', label: 'Wrong item' },
    { value: 'not_as_described', label: 'Not as described' },
    { value: 'changed_mind', label: 'Changed my mind' },
    { value: 'other', label: 'Other' }
  ];

  // Image picker function (matching web validation logic)
  const pickImages = async () => {
    if (evidenceImages.length >= 5) {
      Alert.alert('Limit Reached', 'You can only upload up to 5 images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - evidenceImages.length,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets) {
      // Process images with web-like validation and structure
      const processedImages = result.assets.map((asset, index) => {
        // Extract file extension and determine MIME type
        const uri = asset.uri;
        const extension = uri.split('.').pop()?.toLowerCase();
        let mimeType = 'image/jpeg'; // default
        
        if (extension === 'png') {
          mimeType = 'image/png';
        } else if (extension === 'jpg' || extension === 'jpeg') {
          mimeType = 'image/jpeg';
        }
        
        // Reject GIFs (matching web logic)
        if (extension === 'gif') {
          Alert.alert('Invalid File', 'GIF files are not supported. Please use PNG or JPG files.');
          return null;
        }

        // Create web-like structure
        return {
          uri: asset.uri,
          type: mimeType,
          name: `evidence_${Date.now()}_${index}.${extension || 'jpg'}`,
          file: {
            uri: asset.uri,
            type: mimeType,
            name: `evidence_${Date.now()}_${index}.${extension || 'jpg'}`,
          },
          preview: asset.uri,
          id: Date.now() + Math.random() + index,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize
        };
      }).filter(Boolean); // Remove null values (rejected files)

      // Validate file sizes (max 10MB like web)
      const maxSizeBytes = 10 * 1024 * 1024;
      const validImages = processedImages.filter(img => {
        if (img.fileSize && img.fileSize > maxSizeBytes) {
          Alert.alert('File Too Large', `Image ${img.name} is too large. Maximum size is 10MB.`);
          return false;
        }
        return true;
      });

      if (validImages.length > 0) {
        setEvidenceImages(prev => [...prev, ...validImages].slice(0, 5));
      }
    }
  };

  const removeImage = (index) => {
    setEvidenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReturn = async () => {
    if (!order?.orderId) return;
    
    if (!isDelivered) {
      Alert.alert('Error', 'Only delivered orders can be returned');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      const { data } = await supabase.auth.getSession();
      const at = data?.session?.access_token || '';
      const rt = data?.session?.refresh_token || '';

      // Create FormData to match web version exactly
      const formData = new FormData();
      formData.append('orderId', order.orderId);
      formData.append('reason', reason);
      if (description) formData.append('description', description);
      
      // Append evidence images (matching web logic)
      evidenceImages.forEach((image) => {
        // Use the file object structure that matches web expectations
        formData.append('evidence', {
          uri: image.uri,
          type: image.type, // Use detected MIME type
          name: image.name, // Use generated name with proper extension
        });
      });

      const response = await fetch(`${API_BASE}/returns`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Cookie: `access_token=${at}; refresh_token=${rt}`,
          'Authorization': `Bearer ${at}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert('Success', 'Return request submitted successfully. We will review your request and get back to you soon.');
        setReason('');
        setDescription('');
        onClose();
        if (onReturnSubmitted) {
          onReturnSubmitted();
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to submit return request');
      }
    } catch (error) {
      console.error('Error submitting return:', error);
      Alert.alert('Error', 'Failed to submit return request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Return</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Order Info */}
            <View style={styles.orderInfo}>
              <Text style={styles.sectionTitle}>Order Information</Text>
              <View style={styles.orderDetails}>
                <Text style={styles.orderText}>Order ID: #{order.orderId.slice(0, 8)}</Text>
                <Text style={styles.orderText}>
                  Total: ₱{parseFloat(order.totalAmount).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Delivery Status Warning */}
            {!isDelivered && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Only delivered orders can be returned.</Text>
              </View>
            )}

            {/* Return Reason */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reason for Return *</Text>
              <View style={styles.reasonContainer}>
                {returnReasons.map((reasonOption) => (
                  <TouchableOpacity
                    key={reasonOption.value}
                    style={[
                      styles.reasonOption,
                      reason === reasonOption.value && styles.reasonOptionSelected
                    ]}
                    onPress={() => setReason(reasonOption.value)}
                  >
                    <View style={styles.radioButton}>
                      {reason === reasonOption.value && (
                        <View style={styles.radioButtonSelected} />
                      )}
                    </View>
                    <Text style={[
                      styles.reasonText,
                      reason === reasonOption.value && styles.reasonTextSelected
                    ]}>
                      {reasonOption.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description *</Text>
              <Text style={styles.sectionSubtitle}>
                Please provide details about the issue with your order
              </Text>
              <TextInput
                style={styles.textArea}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the issue in detail..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Evidence Photos */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Evidence Photos (Optional)</Text>
              <Text style={styles.sectionSubtitle}>
                Up to 5 images, PNG/JPG only
              </Text>

              <View style={styles.imageGrid}>
                {evidenceImages.map((item, index) => (
                  <View key={item.id || index} style={styles.imageWrapper}>
                    <Image source={{ uri: item.preview || item.uri }} style={styles.evidenceImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={14} color="#000" />
                    </TouchableOpacity>
                  </View>
                ))}
                
                {evidenceImages.length < 5 && (
                  <TouchableOpacity style={styles.addPhotoPlaceholder} onPress={pickImages}>
                    <Ionicons name="camera-outline" size={32} color="#A68C7B" />
                    <Text style={styles.addPhotoText}>Add Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Error Display */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Important Note */}
            <View style={styles.noteContainer}>
              <Ionicons name="information-circle" size={20} color="#FF9800" />
              <Text style={styles.noteText}>
                Return requests are reviewed within 24-48 hours. 
                You will be notified via email about the status of your request.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.submitButton, 
                (isSubmitting || !isDelivered || !description.trim()) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmitReturn}
              disabled={isSubmitting || !isDelivered || !description.trim()}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  orderInfo: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  orderDetails: {
    marginTop: 8,
  },
  orderText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  reasonContainer: {
    gap: 12,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  reasonOptionSelected: {
    backgroundColor: '#FFF5EB',
    borderColor: '#A68C7B',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#A68C7B',
  },
  reasonText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#A68C7B',
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    backgroundColor: '#fff',
  },
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  noteText: {
    fontSize: 14,
    color: '#F57C00',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#A68C7B',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#A68C7B',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#A68C7B',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // New styles for image upload
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#A68C7B',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 8,
  },
  uploadButtonText: {
    color: '#A68C7B',
    fontSize: 14,
    fontWeight: '600',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
  },
  imageWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  evidenceImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addPhotoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#A68C7B',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  addPhotoText: {
    color: '#A68C7B',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ReturnRequestModal;
