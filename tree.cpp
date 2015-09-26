#include <iostream>
#include <sstream>
#include <string>
#include <stdexcept>
#include <list>
#include <vector>
#include <algorithm>
#include <numeric>

using std::list;
using std::string;
using std::runtime_error;

int global_max_depth = 0;

struct Tree {
    list<Tree> leaves;
    string name, name_prefix, name_id;
    int total_leaves, total_nodes;
};

void split_name(Tree &tree) {
    int uscore_pos = tree.name.find_last_of('_');
    tree.name_prefix = tree.name.substr(0,uscore_pos);
    tree.name_id = tree.name.substr(uscore_pos+1);
}

string read_string(std::istream &is) {
    std::ostringstream oss;
    while (true) {
        char c = is.peek();
        if (c == ',' || c == ')' || c == ';' || is.eof()) return oss.str();
        oss << c;
        is.ignore();
    }
    throw runtime_error("unexpected eof");
}

Tree read_tree_newick(std::istream &is, int depth = 0) {
    
    Tree tree;
    tree.total_leaves = 0;
    tree.total_nodes = 1;
    
    if (global_max_depth < depth) global_max_depth = depth;
    
    if (is.peek() == '(') {
        is.ignore();
        while (true) {
            Tree child = read_tree_newick(is, depth+1);
            tree.leaves.push_back(child);
            
            tree.total_leaves += child.total_leaves;
            tree.total_nodes += child.total_nodes;
            
            char c = is.get();
            if (c == ',') continue;
            if (c == ')') break;
            throw runtime_error("unexpected token "+string(1, c));
        }
    } else {
        tree.total_leaves = 1;
    }
    
    tree.name = read_string(is);
    split_name(tree);
    
    if (depth == 0 && is.peek() == ';') is.ignore();
    return tree;
}

void write_tree_newick(const Tree& tree, std::ostream &os, bool root = true) {
    
    if (tree.leaves.size() > 0) {
        os << '(';
        list<Tree>::const_iterator itr = tree.leaves.begin();
        while(itr != tree.leaves.end()) {
            write_tree_newick(*itr, os, false);
            itr++;
            if (itr != tree.leaves.end()) os << ',';
        }
        os << ')';
    }
    os << tree.name;
    if (root) os << ';' << std::endl;
}

void write_json_str(std::ostream &os, const string &str) {
    os << "\"";
    for (unsigned int i = 0; i < str.size(); ++i) {
        if (str[i] == '"') os << "\\\"";
        else os << str[i];
    }
    os << "\"";
}

std::vector<int> pruned;
const int MAX_PRUNE_SIZE = 300000;

void write_tree_json(const Tree& tree, std::ostream &os, bool root = true, int max_depth = 100000) {
    
    os << "{";
    const string &name = tree.name_prefix;
    
    if (name.size() > 0) {
        os << "\"n\":";
        write_json_str(os, name);
    }
    
    if (tree.leaves.size() > 0) {
        
        if (name.size() > 0) os << ',';
        
        os << "\"s\":" << tree.total_leaves;
        if (max_depth <= 0 && tree.total_nodes < MAX_PRUNE_SIZE) {
            pruned.push_back(tree.total_nodes);
        } else {
            os << ",\"c\":[";
            list<Tree>::const_iterator itr = tree.leaves.begin();
            while(itr != tree.leaves.end()) {
                write_tree_json(*itr, os, false, max_depth-1);
                itr++;
                if (itr != tree.leaves.end()) os << ',';
            }
            os << ']';
        }
    }
    os << '}';
    if (root) os << std::endl;
}

void write_tree_structure_json(const Tree& tree, std::ostream &os, bool root = true) {
    
    os << "[";
    if (tree.leaves.size() > 0) {
        list<Tree>::const_iterator itr = tree.leaves.begin();
        while(itr != tree.leaves.end()) {
            write_tree_structure_json(*itr, os, false);
            itr++;
            if (itr != tree.leaves.end()) os << ',';
        }
    }
    os << ']';
    if (root) os << std::endl;
}

void write_tree_names_json(const Tree& tree, std::ostream &os, bool root = true) {
    
    const string &name = tree.name_prefix;
    os << name << ',';
    for (list<Tree>::const_iterator itr = tree.leaves.begin();
         itr != tree.leaves.end(); ++itr) {
        write_tree_names_json(*itr, os, false);
    }
    if (root) os << std::endl;
}

int main() {
    Tree tree = read_tree_newick(std::cin);
    std::cerr << tree.name << std::endl;
    std::cerr << tree.total_leaves << " leaf nodes" << std::endl;
    std::cerr << tree.total_nodes << " nodes" << std::endl;
    std::cerr << global_max_depth << " max depth" << std::endl;
    
    write_tree_json(tree, std::cout, true, 10);
    write_tree_structure_json(tree, std::cout);
    //write_tree_names_json(tree, std::cout);
    
    std::cerr << pruned.size() << " trees pruned" << std::endl;
    std::cerr << *std::max_element(pruned.begin(), pruned.end()) << " max pruned tree size" << std::endl;
    std::cerr << std::accumulate(pruned.begin(), pruned.end(), 0) << " nodes pruned" << std::endl;
}
