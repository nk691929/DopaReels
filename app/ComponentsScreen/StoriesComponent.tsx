import { View, Text, StyleSheet, Image, ScrollView } from 'react-native'
import React from 'react'
import { supabase } from '../../supabase.config';

const StoriesComponent = () => {

    const fetchStories = async () => {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        // Get user's following list
              const { data: following } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.id);
        
              const followingIds = following?.map(f => f.following_id) || [];
    }
    return (
        <View style={styles.container}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.shortContainer}>
                    <Image source={require('../../src/assets/images/person.png')} style={styles.image} />
                    <Text style={styles.text}>Name</Text>
                </View>
                <View style={styles.shortContainer}>
                    <Image source={require('../../src/assets/images/person.png')} style={styles.image} />
                    <Text style={styles.text}>Name</Text>
                </View>
                <View style={styles.shortContainer}>
                    <Image source={require('../../src/assets/images/person.png')} style={styles.image} />
                    <Text style={styles.text}>Name</Text>
                </View>
                <View style={styles.shortContainer}>
                    <Image source={require('../../src/assets/images/person.png')} style={styles.image} />
                    <Text style={styles.text}>Name</Text>
                </View>
                <View style={styles.shortContainer}>
                    <Image source={require('../../src/assets/images/person.png')} style={styles.image} />
                    <Text style={styles.text}>Name</Text>
                </View>
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        padding: 5,
        flexDirection: 'row',
        margin: 5,
        borderBottomColor: "#000",
        borderBottomWidth: 1,
    },
    shortContainer: {
        borderRadius: 50,
        padding: 10,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 5
    },
    image: {
        height: 70,
        width: 70,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: "#fff",
        backgroundColor: "#000000",
        padding: 10
    },
    text: {
        color: '#FFFFFF',
        fontSize: 12,
        marginBottom: 2,
        marginTop: 5,
    }
})

export default StoriesComponent