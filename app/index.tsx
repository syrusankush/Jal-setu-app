import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet, ImageBackground } from "react-native";
import axios from "axios";
import { useRouter } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from "./config";

export default function Index() {
  const [uniqueId, setUniqueId] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  
  const handleLogin = async () => {
    try {
      console.log('Attempting login with:', { uniqueId, password });
      console.log('API URL:', API_URL);
      
      const response = await axios.post(`${API_URL}/auth/login`, {
        uniqueId,
        password,
      });
      
      console.log('Login response:', response.data);
      
      const { token, role, id, gramPanchayatId } = response.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('gramPanchayatId', gramPanchayatId);
      
      // Verify storage
      const storedToken = await AsyncStorage.getItem('token');
      const storedGpId = await AsyncStorage.getItem('gramPanchayatId');
      console.log('Stored values:', {
        token: storedToken,
        gramPanchayatId: storedGpId
      });

      if (role === 'ZP') {
        router.push('/ZP');
      } else if (role === 'Panchayat Pani Samiti') {
        router.push('/panchayatSamitiDashboard');
      } else if (role === 'Grampanchayat') {
        router.push('/grampanchayatDashboard');
      } else if (role === 'Contract Agency') {
        router.push('/contractAgencyDashboard');
      } else if (role === 'User') {
        router.push('/userDashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (axios.isAxiosError(error) && error.response) {
        Alert.alert('Login Failed', error.response.data.message);
      } else {
        Alert.alert('Login Failed', 'An error occurred. Please try again later.');
      }
    }
  };

  return (
    <ImageBackground
      source={require('./jalshakti.png')}
      style={styles.background}
    >
      <View style={styles.container}>
      <Text style={styles.title}>Hello</Text>
      <Text style={styles.subtitle}>Sign in!</Text>

      <TextInput
        style={styles.input}
        placeholder="UNIQUE ID"
        value={uniqueId}
        onChangeText={setUniqueId}
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.buttonContainer}>
        <Button title="SIGN IN" onPress={handleLogin} color="#0000FF" />
      </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: 300,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 15,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
  subtitle: {
    fontSize: 18,
    color: "#000",
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: "rgba(221, 221, 221, 0.7)",
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 15,
    paddingLeft: 10,
    width: "100%",
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  buttonContainer: {
    marginTop: 10,
    borderRadius: 5,
    overflow: 'hidden',
    width: "100%",
  },
});
