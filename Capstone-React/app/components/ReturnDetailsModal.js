import React, { useState, useEffect } from 'react';
import {Modal, View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase/supabaseClient';

const API_BASE = "http://192.168.254.114:3000/api";

const ReturnDetailsModal = ({ visible, onClose, returnId, role = 'buyer' }) => {
  const [returnDetails, setReturnDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sellerResponse, setSellerResponse] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [receivedCondition, setReceivedCondition] = useState('');

  useEffect(() => {
    if (visible && returnId) {
      fetchReturnDetails();
    }
  }, [visible, returnId]);

  const fetchReturnDetails = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const at = data?.session?.access_token || '';
      const rt = data?.session?.refresh_token || '';

      const response = await fetch(`${API_BASE}/returns/${returnId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Cookie: `access_token=${at}; refresh_token=${rt}`,
          'Authorization': `Bearer ${at}`,
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setReturnDetails(result.data);
      } else {
        Alert.alert('Error', 'Failed to load return details');
        onClose();
      }
    } catch (error) {
      console.error('Error fetching return details:', error);
      Alert.alert('Error', 'Failed to load return details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Send message function
  const sendMessage = async () => {
    if (!message.trim()) return;
    try {
      setActionLoading(true);
      const { data } = await supabase.auth.getSession();
      const at = data?.session?.access_token || '';
      const rt = data?.session?.refresh_token || '';

      await fetch(`${API_BASE}/returns/${returnId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `access_token=${at}; refresh_token=${rt}`,
          'Authorization': `Bearer ${at}`,
        },
        body: JSON.stringify({ message })
      });

      setMessage('');
      await fetchReturnDetails(); // Refresh data
    } catch (e) {
      setError(e.message || 'Failed to send message');
    } finally {
      setActionLoading(false);
    }
  };

  // Dispute function
  const dispute = async () => {
    try {
      setActionLoading(true);
      const { data } = await supabase.auth.getSession();
      const at = data?.session?.access_token || '';
      const rt = data?.session?.refresh_token || '';

      await fetch(`${API_BASE}/returns/${returnId}/dispute`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `access_token=${at}; refresh_token=${rt}`,
          'Authorization': `Bearer ${at}`,
        },
        body: JSON.stringify({ disputeReason: 'Buyer disputes the rejection' })
      });

      await fetchReturnDetails();
    } catch (e) {
      setError(e.message || 'Failed to dispute return');
    } finally {
      setActionLoading(false);
    }
  };

  // Approve function
  const approve = async () => {
    try {
      setActionLoading(true);
      const { data } = await supabase.auth.getSession();
      const at = data?.session?.access_token || '';
      const rt = data?.session?.refresh_token || '';

      await fetch(`${API_BASE}/returns/${returnId}/approve`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `access_token=${at}; refresh_token=${rt}`,
          'Authorization': `Bearer ${at}`,
        },
        body: JSON.stringify({ sellerResponse: sellerResponse || 'Approved' })
      });

      await fetchReturnDetails();
    } catch (e) {
      setError(e.message || 'Failed to approve return');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject function
  const reject = async () => {
    try {
      setActionLoading(true);
      const { data } = await supabase.auth.getSession();
      const at = data?.session?.access_token || '';
      const rt = data?.session?.refresh_token || '';

      await fetch(`${API_BASE}/returns/${returnId}/reject`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `access_token=${at}; refresh_token=${rt}`,
          'Authorization': `Bearer ${at}`,
        },
        body: JSON.stringify({ sellerResponse: sellerResponse || 'Rejected' })
      });

      await fetchReturnDetails();
    } catch (e) {
      setError(e.message || 'Failed to reject return');
    } finally {
      setActionLoading(false);
    }
  };

  // Mark shipped function
  const markShipped = async () => {
    try {
      setActionLoading(true);
      const { data } = await supabase.auth.getSession();
      const at = data?.session?.access_token || '';
      const rt = data?.session?.refresh_token || '';

      const body = {};
      if (trackingNumber.trim()) body.tracking_number = trackingNumber.trim();

      await fetch(`${API_BASE}/returns/${returnId}/shipped`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `access_token=${at}; refresh_token=${rt}`,
          'Authorization': `Bearer ${at}`,
        },
        body: JSON.stringify(body)
      });

      setTrackingNumber('');
      await fetchReturnDetails();
    } catch (e) {
      setError(e.message || 'Failed to mark as shipped');
    } finally {
      setActionLoading(false);
    }
  };

  // Mark received function
  const markReceived = async () => {
    try {
      setActionLoading(true);
      const { data } = await supabase.auth.getSession();
      const at = data?.session?.access_token || '';
      const rt = data?.session?.refresh_token || '';

      const body = {};
      if (receivedCondition.trim()) body.received_condition = receivedCondition.trim();

      await fetch(`${API_BASE}/returns/${returnId}/received`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `access_token=${at}; refresh_token=${rt}`,
          'Authorization': `Bearer ${at}`,
        },
        body: JSON.stringify(body)
      });

      setReceivedCondition('');
      await fetchReturnDetails();
    } catch (e) {
      setError(e.message || 'Failed to mark as received');
    } finally {
      setActionLoading(false);
    }
  };

  // Resolve dispute function
  const resolveAs = async (resolution) => {
    try {
      if (!adminNotes.trim()) {
        setError('Admin notes are required to resolve a dispute');
        return;
      }
      setActionLoading(true);
      const { data } = await supabase.auth.getSession();
      const at = data?.session?.access_token || '';
      const rt = data?.session?.refresh_token || '';

      await fetch(`${API_BASE}/returns/${returnId}/resolve`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `access_token=${at}; refresh_token=${rt}`,
          'Authorization': `Bearer ${at}`,
        },
        body: JSON.stringify({ resolution, adminNotes })
      });

      setAdminNotes('');
      await fetchReturnDetails();
    } catch (e) {
      setError(e.message || 'Failed to resolve dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { text: 'Under Review', color: '#FF9800', icon: 'time-outline' },
      approved: { text: 'Approved', color: '#4CAF50', icon: 'checkmark-circle-outline' },
      rejected: { text: 'Rejected', color: '#F44336', icon: null },
      refunded: { text: 'Refunded', color: '#2196F3', icon: 'card-outline' }
    };

    const config = statusConfig[status] || { text: status, color: '#999', icon: 'help-circle-outline' };

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        {config.icon && <Ionicons name={config.icon} size={16} color="#fff" />}
        <Text style={styles.statusBadgeText}>{config.text}</Text>
      </View>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price) => {
    return `₱${parseFloat(price).toLocaleString('en-PH', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  if (!returnDetails && !loading) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView 
          style={styles.modalContent}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Return Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#A68C7B" />
              <Text style={styles.loadingText}>Loading return details...</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Header Section with Return ID and Status */}
              <View style={styles.headerSection}>
                <View style={styles.headerRow}>
                  <View style={styles.headerLeft}>
                    <Text style={styles.headerLabel}>Return ID</Text>
                    <Text style={styles.headerValue}>#{returnDetails.returnId.slice(0, 8)}</Text>
                  </View>
                  <View style={styles.headerRight}>
                    {getStatusBadge(returnDetails.status)}
                  </View>
                </View>
                
                <View style={styles.basicInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Reason</Text>
                    <Text style={styles.infoValue}>{returnDetails.reason?.replace(/_/g, ' ')}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Description</Text>
                    <Text style={styles.infoValue}>{returnDetails.description || '—'}</Text>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Conversation */}
              <View style={styles.conversationSection}>
                <Text style={styles.sectionTitle}>Conversation</Text>
                <ScrollView style={styles.conversationContainer} showsVerticalScrollIndicator={true}>
                  {returnDetails.messages && returnDetails.messages.length > 0 ? (
                    returnDetails.messages.map((msg, index) => (
                      <View key={index} style={styles.conversationItem}>
                        <View style={styles.messageHeader}>
                          <Text style={styles.messageDate}>{formatDate(msg.createdAt)}</Text>
                          {msg.isAdmin && (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>Admin</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.messageText}>{msg.message}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noMessagesText}>No messages yet.</Text>
                  )}
                </ScrollView>

                <View style={styles.messageInputRow}>
                  <TextInput
                    style={styles.messageInput}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Write a message..."
                    multiline={false}
                  />
                  <TouchableOpacity
                    style={[styles.sendButton, (!message.trim() || actionLoading) && styles.sendButtonDisabled]}
                    onPress={sendMessage}
                    disabled={!message.trim() || actionLoading}
                  >
                    <Text style={styles.sendButtonText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Seller Actions */}
              {role === 'seller' && returnDetails.status === 'pending' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Response to Buyer (Optional)</Text>
                  <TextInput
                    style={styles.textArea}
                    value={sellerResponse}
                    onChangeText={setSellerResponse}
                    placeholder="Provide response to buyer..."
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.rejectButton, actionLoading && styles.buttonDisabled]}
                      onPress={reject}
                      disabled={actionLoading}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveButton, actionLoading && styles.buttonDisabled]}
                      onPress={approve}
                      disabled={actionLoading}
                    >
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Buyer Dispute Action */}
              {role === 'buyer' && returnDetails.status === 'rejected' && !returnDetails.resolvedAt && (
                <View style={styles.disputeSection}>
                  <TouchableOpacity
                    style={[styles.disputeButton, actionLoading && styles.buttonDisabled]}
                    onPress={dispute}
                    disabled={actionLoading}
                  >
                    <Text style={styles.disputeButtonText}>Dispute Decision</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Return Address & Shipping */}
              {returnDetails.shippingStatus === "pendingShipment" && role === 'buyer' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Return Address</Text>
                  <View style={styles.addressContainer}>
                    {returnDetails.returnAddress ? (
                      <View>
                        <Text style={styles.addressName}>{returnDetails.returnAddress.name || 'Seller'}</Text>
                        {returnDetails.returnAddress.phone && (
                          <Text style={styles.addressText}>Phone: {returnDetails.returnAddress.phone}</Text>
                        )}
                        <Text style={styles.addressText}>{returnDetails.returnAddress.address1 || '—'}</Text>
                        {returnDetails.returnAddress.address2 && (
                          <Text style={styles.addressText}>{returnDetails.returnAddress.address2}</Text>
                        )}
                        <Text style={styles.addressText}>
                          {[
                            returnDetails.returnAddress.barangay,
                            returnDetails.returnAddress.city,
                            returnDetails.returnAddress.province
                          ].filter(Boolean).join(', ')}
                        </Text>
                        <Text style={styles.addressText}>
                          {[
                            returnDetails.returnAddress.region,
                            returnDetails.returnAddress.postalCode
                          ].filter(Boolean).join(' ')}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.noAddressText}>No return address found. Please contact the seller.</Text>
                    )}
                  </View>

                  <Text style={styles.sectionTitle}>Tracking Number (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={trackingNumber}
                    onChangeText={setTrackingNumber}
                    placeholder="Enter shipping tracking number"
                  />
                  <Text style={styles.helperText}>Please ship the item to the address above, then mark it as shipped.</Text>

                  <TouchableOpacity
                    style={[styles.primaryButton, actionLoading && styles.buttonDisabled]}
                    onPress={markShipped}
                    disabled={actionLoading}
                  >
                    <Text style={styles.primaryButtonText}>Mark as Shipped</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Error Display */}
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}


              {/* Help Note */}
              <View style={styles.noteContainer}>
                <Ionicons name="information-circle" size={20} color="#FF9800" />
                <Text style={styles.noteText}>
                  If you have any questions about your return, please contact our customer support.
                </Text>
              </View>
              
              {/* Bottom Spacer */}
              <View style={styles.bottomSpacer} />
            </ScrollView>
          )}

        </KeyboardAvoidingView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  
  // Header section styles
  headerSection: {
    marginBottom: 16,
  },
  basicInfo: {
    marginTop: 16,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    textTransform: 'capitalize',
  },
  
  // Divider
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 20,
  },
  
  // Conversation section
  conversationSection: {
    marginBottom: 20,
  },
  conversationContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    maxHeight: 200,
    minHeight: 120,
  },
  conversationItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  messageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  // Dispute section
  disputeSection: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reasonContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  descriptionContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  responseContainer: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  responseText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
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
  
  // Bottom spacer for proper spacing
  bottomSpacer: {
    height: 30,
  },
  
  // Header section styles (web-like)
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  headerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  
  // Form group styles (web-like)
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  formValue: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    textTransform: 'capitalize',
  },
  
  // New styles for conversation and actions
  messagesContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    maxHeight: 200,
  },
  messageItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageDate: {
    fontSize: 12,
    color: '#999',
  },
  adminBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  noMessagesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  messageInputContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    height: 40,
  },
  sendButton: {
    backgroundColor: '#A68C7B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#F44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disputeButton: {
    backgroundColor: '#A68C7B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  disputeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  addressContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  addressName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  noAddressText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#A68C7B',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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

export default ReturnDetailsModal;
